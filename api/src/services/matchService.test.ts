import { SHOT, TIMING } from '@sectorball/shared';
import type { GameState, MatchView, PlayerInfo } from '@sectorball/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/sqlite.ts';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import { createSqliteMatchRepository } from '../models/sqlite/matchRepository.ts';
import { createSqlitePlayerRepository } from '../models/sqlite/playerRepository.ts';
import { createMatchService } from './matchService.ts';

const PULL = { x: SHOT.minPull, y: 0 };

const stateOf = (view: MatchView | undefined): GameState => {
  if (!view?.state) throw new Error('expected a view with a game state');
  return view.state;
};

const setup = async () => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  const addPlayer = async (id: string): Promise<PlayerInfo> => {
    await players.create({ id, nickname: `nick-${id}`, tokenHash: `hash-${id}`, createdAt: '2026-01-01T00:00:00Z' });
    return { id, nickname: `nick-${id}` };
  };
  const clock = { now: 1_000_000 };
  const service = createMatchService({
    matches: createSqliteMatchRepository(db),
    now: () => clock.now,
    random: () => 0.1,
  });
  const alice = await addPlayer('alice');
  const bob = await addPlayer('bob');
  const carol = await addPlayer('carol');
  const rowOf = (id: string) => db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  return { service, clock, alice, bob, carol, rowOf };
};

const liveMatch = async () => {
  const ctx = await setup();
  const created = await ctx.service.create(ctx.alice);
  const view = await ctx.service.join(created.id, ctx.bob);
  return { ...ctx, view, id: view.id };
};

describe('matchService', () => {
  it('lists a created match as open', async () => {
    const { service, alice, clock } = await setup();
    const view = await service.create(alice);

    expect(view).toMatchObject({ status: 'open', home: alice, away: null, state: null, serverNow: clock.now });
    expect(view.connected).toEqual({ home: false, away: false });
    expect(service.listOpen()).toEqual([
      { id: view.id, status: 'open', home: alice, away: null, createdAt: view.createdAt },
    ]);
  });

  it('lists open matches newest first', async () => {
    const { service, alice, bob, clock } = await setup();
    const older = await service.create(alice);
    clock.now += 1000;
    const newer = await service.create(bob);

    expect(service.listOpen().map((m) => m.id)).toEqual([newer.id, older.id]);
  });

  it('starts the game when a second player joins', async () => {
    const { service, view, bob, rowOf } = await liveMatch();

    expect(view).toMatchObject({ status: 'live', away: bob });
    expect(view.state?.turn).toBe('home');
    expect(service.listOpen()).toEqual([]);
    expect(rowOf(view.id)).toMatchObject({ status: 'live', away_player_id: 'bob' });
  });

  it('rejects an unknown match', async () => {
    const { service, bob } = await setup();
    await expect(service.join('nope', bob)).rejects.toThrow(new NotFoundError('matchNotFound'));
    expect(() => service.get('nope')).toThrow(new NotFoundError('matchNotFound'));
  });

  it('rejects joining a full match', async () => {
    const { service, id, carol } = await liveMatch();
    await expect(service.join(id, carol)).rejects.toThrow(new ConflictError('matchFull'));
  });

  it('rejects joining your own match', async () => {
    const { service, alice } = await setup();
    const { id } = await service.create(alice);
    await expect(service.join(id, alice)).rejects.toThrow(new ConflictError('ownMatch'));
  });

  it('tells the team of a player', async () => {
    const { service, id } = await liveMatch();
    expect(service.teamOf(id, 'alice')).toBe('home');
    expect(service.teamOf(id, 'bob')).toBe('away');
    expect(service.teamOf(id, 'carol')).toBeNull();
  });

  it('tracks connected teams in the view', async () => {
    const { service, id } = await liveMatch();
    expect(service.setConnected(id, 'away', true).connected).toEqual({ home: false, away: true });
    expect(service.get(id).connected).toEqual({ home: false, away: true });
  });

  it('applies a shot and returns its replay', async () => {
    const { service, id, view } = await liveMatch();
    const seq = stateOf(view).seq;
    const { view: next, replay } = await service.shoot(id, 'alice', { seq, pieceId: 'home-1', pull: PULL });

    expect(stateOf(next).seq).toBeGreaterThan(seq);
    expect(replay.frames.length).toBeGreaterThan(0);
    expect(service.get(id).state).toEqual(next.state);
  });

  it('rejects actions with a stale seq', async () => {
    const { service, id } = await liveMatch();
    const input = { seq: 0, pieceId: 'home-1', pull: PULL } as const;
    await service.shoot(id, 'alice', input);

    await expect(service.shoot(id, 'alice', input)).rejects.toThrow(new ValidationError('staleState'));
    await expect(service.declareShot(id, 'bob', 0)).rejects.toThrow(new ValidationError('staleState'));
  });

  it('passes engine errors through as validation errors', async () => {
    const { service, id } = await liveMatch();
    await expect(service.shoot(id, 'bob', { seq: 0, pieceId: 'away-1', pull: PULL })).rejects.toThrow(
      new ValidationError('notYourTurn'),
    );
    await expect(service.confirmKeeper(id, 'alice', 0)).rejects.toThrow(new ValidationError('wrongPhase'));
    expect(() => service.moveKeeper(id, 'bob', 300)).toThrow(new ValidationError('wrongPhase'));
  });

  it('rejects actions by non-participants', async () => {
    const { service, id } = await liveMatch();
    await expect(service.shoot(id, 'carol', { seq: 0, pieceId: 'home-1', pull: PULL })).rejects.toThrow(
      new ConflictError('notParticipant'),
    );
    expect(() => service.moveKeeper(id, 'carol', 300)).toThrow(new ConflictError('notParticipant'));
  });

  it('rejects actions on a match that is not live', async () => {
    const { service, alice } = await setup();
    const { id } = await service.create(alice);
    await expect(service.declareShot(id, 'alice', 0)).rejects.toThrow(new ConflictError('matchNotLive'));
  });

  it('applies a turn timeout on tick', async () => {
    const { service, clock, id } = await liveMatch();
    expect(await service.tick()).toEqual([]);

    clock.now += TIMING.turnLimitMs;
    const views = await service.tick();

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id, serverNow: clock.now });
    expect(stateOf(views[0]).lastDecision).toEqual({ kind: 'turnTimeout', team: 'home' });
  });

  it('finishes the match after two halves and stores the result', async () => {
    const { service, clock, id, rowOf } = await liveMatch();
    clock.now += TIMING.halfLengthMs;
    await service.tick();
    clock.now += TIMING.halfLengthMs;
    const [view] = await service.tick();

    expect(view).toMatchObject({ id, status: 'finished' });
    expect(stateOf(view).phase).toBe('finished');
    expect(rowOf(id)).toMatchObject({
      status: 'finished',
      home_score: 0,
      away_score: 0,
      finished_at: new Date(clock.now).toISOString(),
    });
    expect(await service.tick()).toEqual([]);
    await expect(service.declareShot(id, 'alice', stateOf(view).seq)).rejects.toThrow(
      new ConflictError('matchNotLive'),
    );
  });
});
