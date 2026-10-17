import { describe, expect, it } from 'vitest';
import { vec } from './geometry.ts';
import { judgeShot } from './referee.ts';
import type { BallExit, Contact, SimResult } from './physics.ts';
import type { GameState, Piece, PieceId, Restart, Team } from './types.ts';

const piece = (id: PieceId, team: Team, x: number, y: number): Piece => ({
  id,
  team,
  kind: id.endsWith('gk') ? 'keeper' : 'button',
  pos: vec(x, y),
});

const shooter = piece('home-1', 'home', 150, 320);
const passer = piece('home-4', 'home', 400, 250);
const pieces: Piece[] = [
  shooter,
  piece('home-2', 'home', 260, 170),
  passer,
  piece('home-gk', 'home', 30, 320),
  piece('away-1', 'away', 850, 320),
  piece('away-2', 'away', 740, 170),
  piece('away-gk', 'away', 970, 320),
];

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  matchId: 'm',
  phase: 'aiming',
  half: 1,
  turn: 'home',
  firstKickoff: 'home',
  score: { home: 0, away: 0 },
  pieces,
  ball: vec(500, 320),
  restart: null,
  shotDeclared: false,
  halfStartedAt: 0,
  turnStartedAt: 0,
  lastDecision: null,
  winner: null,
  seq: 0,
  ...overrides,
});

const contact = (a: string, b: string, x = 500, y = 320): Contact => ({ step: 0, a, b, at: vec(x, y) });

const fakeSim = (
  parts: { contacts?: Contact[]; ballExit?: BallExit | null; ballLeftCenterCircle?: boolean } = {},
): SimResult => ({
  frames: [],
  contacts: parts.contacts ?? [],
  ballExit: parts.ballExit ?? null,
  ballLeftCenterCircle: parts.ballLeftCenterCircle ?? true,
  pieces: [],
  ball: vec(500, 320),
});

const goalRight: BallExit = { kind: 'goal', side: 'right', at: vec(1000, 320) };
const penalty: Restart = { kind: 'penalty', kickerId: 'home-1' };

describe('judgeShot', () => {
  describe('fouls', () => {
    it('awards a free kick to the victim when touching an opponent button first', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'away-1', 600, 300)] });
      expect(judgeShot(baseState(), shooter, sim)).toEqual({
        kind: 'foul',
        awardedTo: 'away',
        at: vec(600, 300),
        penalty: false,
      });
    });

    it('is a penalty inside the fouler own box', () => {
      const sim = fakeSim({ contacts: [contact('away-1', 'home-1', 100, 320)] });
      const decision = judgeShot(baseState(), shooter, sim);
      expect(decision).toMatchObject({ kind: 'foul', awardedTo: 'away', penalty: true });
    });

    it('moves a foul just behind the goal line into the field, inside the goal mouth a penalty', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'away-1', -5, 320)] });
      expect(judgeShot(baseState(), shooter, sim)).toEqual({
        kind: 'foul',
        awardedTo: 'away',
        at: vec(0, 320),
        penalty: true,
      });
    });

    it('is not a penalty in the box of the other half', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'away-1', 100, 320)] });
      expect(judgeShot(baseState({ half: 2 }), shooter, sim)).toMatchObject({ kind: 'foul', penalty: false });
    });

    it('is not a foul after the shooter touched the ball', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'ball'), contact('home-1', 'away-1')] });
      expect(judgeShot(baseState(), shooter, sim)).toEqual({ kind: 'play', pass: false });
    });

    it('still fouls when a teammate was touched before the opponent', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'home-2'), contact('home-1', 'away-1', 600, 300)] });
      expect(judgeShot(baseState(), shooter, sim)).toMatchObject({ kind: 'foul', at: vec(600, 300) });
    });

    it('still fouls when a post was touched before the opponent', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'post'), contact('home-1', 'away-1')] });
      expect(judgeShot(baseState(), shooter, sim).kind).toBe('foul');
    });

    it('ignores keepers and posts', () => {
      expect(judgeShot(baseState(), shooter, fakeSim({ contacts: [contact('home-1', 'away-gk')] })).kind).toBe('play');
      expect(judgeShot(baseState(), shooter, fakeSim({ contacts: [contact('home-1', 'post')] })).kind).toBe('play');
    });

    it('takes priority over a goal', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'away-1')], ballExit: goalRight });
      expect(judgeShot(baseState({ shotDeclared: true }), shooter, sim).kind).toBe('foul');
    });
  });

  describe('goals', () => {
    it('disallows an undeclared goal and awards the goal owner', () => {
      expect(judgeShot(baseState(), shooter, fakeSim({ ballExit: goalRight }))).toEqual({
        kind: 'goalDisallowed',
        awardedTo: 'away',
      });
    });

    it('scores a declared goal', () => {
      expect(judgeShot(baseState({ shotDeclared: true }), shooter, fakeSim({ ballExit: goalRight }))).toEqual({
        kind: 'goal',
        scorer: 'home',
        ownGoal: false,
      });
    });

    it('counts an undeclared own goal', () => {
      const exit: BallExit = { kind: 'goal', side: 'left', at: vec(0, 320) };
      expect(judgeShot(baseState(), shooter, fakeSim({ ballExit: exit }))).toEqual({
        kind: 'goal',
        scorer: 'away',
        ownGoal: true,
      });
    });

    it('counts a penalty without declaration', () => {
      const decision = judgeShot(baseState({ restart: penalty }), shooter, fakeSim({ ballExit: goalRight }));
      expect(decision).toEqual({ kind: 'goal', scorer: 'home', ownGoal: false });
    });

    it('uses the half to find the goal owner', () => {
      const decision = judgeShot(baseState({ half: 2, shotDeclared: true }), shooter, fakeSim({ ballExit: goalRight }));
      expect(decision).toMatchObject({ scorer: 'away', ownGoal: true });
    });
  });

  describe('ball out', () => {
    const touchline: BallExit = { kind: 'out', line: 'touchline', side: 'right', at: vec(700, 0) };

    it('gives a throw-in to the opponent of the last toucher', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'ball')], ballExit: touchline });
      expect(judgeShot(baseState(), shooter, sim)).toEqual({
        kind: 'out',
        restart: 'throwIn',
        awardedTo: 'away',
        at: vec(700, 0),
      });
    });

    it('uses the last ball-piece contact, ignoring posts', () => {
      const sim = fakeSim({
        contacts: [contact('home-1', 'ball'), contact('ball', 'away-1'), contact('ball', 'post')],
        ballExit: touchline,
      });
      expect(judgeShot(baseState(), shooter, sim)).toMatchObject({ restart: 'throwIn', awardedTo: 'home' });
    });

    it('falls back to the shooter team when the ball was never touched', () => {
      expect(judgeShot(baseState(), shooter, fakeSim({ ballExit: touchline }))).toMatchObject({ awardedTo: 'away' });
    });

    const goalLine: BallExit = { kind: 'out', line: 'goalline', side: 'right', at: vec(1000, 100) };

    it('gives a corner when the defender touched it last', () => {
      const sim = fakeSim({ contacts: [contact('ball', 'away-1')], ballExit: goalLine });
      expect(judgeShot(baseState(), shooter, sim)).toEqual({
        kind: 'out',
        restart: 'corner',
        awardedTo: 'home',
        at: vec(1000, 100),
      });
    });

    it('gives a goal kick when the attacker touched it last', () => {
      const sim = fakeSim({ contacts: [contact('home-1', 'ball')], ballExit: goalLine });
      expect(judgeShot(baseState(), shooter, sim)).toMatchObject({ restart: 'goalKick', awardedTo: 'away' });
    });
  });

  describe('kickoff', () => {
    it('is retaken when the ball stays in the centre circle', () => {
      const state = baseState({ restart: { kind: 'kickoff' } });
      expect(judgeShot(state, shooter, fakeSim({ ballLeftCenterCircle: false }))).toEqual({ kind: 'kickoffRetake' });
    });

    it('plays on when the ball leaves the circle', () => {
      const state = baseState({ restart: { kind: 'kickoff' } });
      expect(judgeShot(state, shooter, fakeSim({ ballLeftCenterCircle: true })).kind).toBe('play');
    });
  });

  describe('pass detection', () => {
    it('detects a pass to a teammate button', () => {
      const sim = fakeSim({ contacts: [contact('home-4', 'ball'), contact('ball', 'home-2')] });
      expect(judgeShot(baseState(), passer, sim)).toEqual({ kind: 'play', pass: true });
    });

    it('is not a pass when the ball hits an opponent', () => {
      const sim = fakeSim({ contacts: [contact('home-4', 'ball'), contact('ball', 'away-1')] });
      expect(judgeShot(baseState(), passer, sim)).toEqual({ kind: 'play', pass: false });
    });

    it('is not a pass when a teammate is hit before the shooter touches the ball', () => {
      const sim = fakeSim({ contacts: [contact('ball', 'home-2'), contact('home-4', 'ball')] });
      expect(judgeShot(baseState(), passer, sim)).toEqual({ kind: 'play', pass: false });
    });
  });
});
