import { describe, expect, it } from 'vitest';
import { FIELD, PIECE, RESTART } from './constants.ts';
import { formation, isInPenaltyArea, isInsideField } from './field.ts';
import type { Vec } from './geometry.ts';
import { distance, vec } from './geometry.ts';
import { cornerPoint, goalKickPoint, placeFreeKick, placePenalty, resolveOverlaps } from './restarts.ts';
import type { Piece } from './types.ts';

const start = (): Piece[] => [...formation('home', 1, false), ...formation('away', 1, false)];
const buttons = (pieces: readonly Piece[]): Piece[] => pieces.filter((p) => p.kind === 'button');
const get = (pieces: readonly Piece[], id: string): Piece => {
  const found = pieces.find((p) => p.id === id);
  if (!found) throw new Error(`missing piece ${id}`);
  return found;
};
const move = (pieces: readonly Piece[], id: string, x: number, y: number): Piece[] =>
  pieces.map((p) => (p.id === id ? { ...p, pos: vec(x, y) } : p));
const BALL_CLEARANCE = PIECE.buttonRadius + PIECE.ballRadius + 1;
const KEEPER_CLEARANCE = PIECE.buttonRadius + 1;
/** Distance from `pos` to the keeper rectangle centred on `keeper`. */
const keeperGap = (pos: Vec, keeper: Vec): number => {
  const dx = Math.max(0, Math.abs(pos.x - keeper.x) - PIECE.keeperWidth / 2);
  const dy = Math.max(0, Math.abs(pos.y - keeper.y) - PIECE.keeperHeight / 2);
  return Math.hypot(dx, dy);
};
const minPairGap = (pieces: readonly Piece[]): number => {
  const b = buttons(pieces);
  let min = Infinity;
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      min = Math.min(min, distance(get(b, b[i]?.id ?? '').pos, get(b, b[j]?.id ?? '').pos));
  return min;
};

describe('resolveOverlaps', () => {
  it('resolves overlaps after placing the ball', () => {
    const base = start();
    const home2 = get(base, 'home-2');
    const { pieces, ball } = placeFreeKick(base, home2.pos, 'away');
    for (const b of buttons(pieces)) {
      expect(distance(b.pos, ball)).toBeGreaterThanOrEqual(BALL_CLEARANCE);
      expect(isInsideField(b.pos)).toBe(true);
    }
    expect(minPairGap(pieces)).toBeGreaterThanOrEqual(PIECE.buttonRadius * 2);
  });

  it('handles a button exactly on the ball without NaN and never moves keepers', () => {
    const base = move(start(), 'away-3', 300, 300);
    const out = resolveOverlaps(base, vec(300, 300), true);
    const moved = get(out, 'away-3');
    expect(Number.isFinite(moved.pos.x) && Number.isFinite(moved.pos.y)).toBe(true);
    expect(distance(moved.pos, vec(300, 300))).toBeGreaterThanOrEqual(BALL_CLEARANCE);
    expect(out.find((p) => p.id === 'home-gk')).toEqual(base.find((p) => p.id === 'home-gk'));
  });

  it.each([
    ['on the goal line in the goal mouth', vec(0, 300)],
    ['centred on the keeper', vec(9, 320)],
    ['touching the keeper from the field side', vec(30, 340)],
  ])('separates a button placed %s from the keeper rectangle', (_label, at) => {
    const base = move(start(), 'away-3', at.x, at.y);
    const keeper = get(base, 'home-gk').pos;
    const out = resolveOverlaps(base, vec(500, 320), false);
    const moved = get(out, 'away-3').pos;
    expect(isInsideField(moved)).toBe(true);
    expect(keeperGap(moved, keeper)).toBeGreaterThanOrEqual(KEEPER_CLEARANCE - 1e-9);
    expect(get(out, 'home-gk').pos).toEqual(keeper);
  });

  it('keeps buttons off the keeper while clearing the ball', () => {
    const base = move(start(), 'away-3', 2, 330);
    const ball = vec(30, 300);
    const out = resolveOverlaps(base, ball, true);
    const moved = get(out, 'away-3').pos;
    expect(keeperGap(moved, get(base, 'home-gk').pos)).toBeGreaterThanOrEqual(KEEPER_CLEARANCE - 1e-9);
    expect(distance(moved, ball)).toBeGreaterThanOrEqual(BALL_CLEARANCE - 1e-9);
  });

  it('does not mutate its input', () => {
    const base = move(start(), 'away-3', 300, 300);
    const snapshot = structuredClone(base);
    resolveOverlaps(base, vec(300, 300), true);
    expect(base).toEqual(snapshot);
  });
});

describe('placeFreeKick', () => {
  it('pushes opponents of the awarded team out to the free-kick distance', () => {
    const base = move(move(start(), 'home-1', 620, 300), 'away-3', 700, 420);
    const { pieces, ball } = placeFreeKick(base, vec(600, 300), 'away');
    expect(ball).toEqual(vec(600, 300));
    expect(distance(get(pieces, 'home-1').pos, ball)).toBeCloseTo(RESTART.freeKickDistance, 3);
    expect(get(pieces, 'away-3').pos).toEqual(vec(700, 420));
  });

  it('keeps the free-kick distance for a throw-in at the touchline', () => {
    const base = move(start(), 'home-1', 500, 0);
    const { pieces, ball } = placeFreeKick(base, vec(500, 2), 'away');
    const moved = get(pieces, 'home-1');
    expect(isInsideField(moved.pos)).toBe(true);
    expect(distance(moved.pos, ball)).toBeGreaterThanOrEqual(RESTART.freeKickDistance);
  });

  it('keeps every constraint with a crowded wall around the ball', () => {
    let base = start();
    const spots = [vec(505, 300), vec(495, 300), vec(500, 310), vec(500, 290), vec(500, 300)];
    (['home-1', 'home-2', 'home-3', 'home-4', 'home-5'] as const).forEach((id, i) => {
      base = move(base, id, spots[i]?.x ?? 0, spots[i]?.y ?? 0);
    });
    const { pieces, ball } = placeFreeKick(base, vec(500, 300), 'away');
    for (const b of buttons(pieces)) {
      expect(isInsideField(b.pos)).toBe(true);
      expect(distance(b.pos, ball)).toBeGreaterThanOrEqual(
        b.team === 'home' ? RESTART.freeKickDistance : BALL_CLEARANCE,
      );
    }
    expect(minPairGap(pieces)).toBeGreaterThanOrEqual(PIECE.buttonRadius * 2);
  });

  it('clamps the ball into the field', () => {
    expect(placeFreeKick(start(), vec(-5, 700), 'home').ball).toEqual(vec(0, FIELD.height));
  });
});

describe('placePenalty', () => {
  it('clears the area and places the kicker on the spot side', () => {
    const base = start();
    const { pieces, ball, kickerId } = placePenalty(base, 'home', 1, 'away');
    expect(ball).toEqual(vec(110, 320));
    expect(kickerId.startsWith('away-')).toBe(true);
    const kicker = get(pieces, kickerId);
    expect(kicker.pos).toEqual(vec(150, 320));
    for (const b of buttons(pieces).filter((p) => p.id !== kickerId))
      expect(isInPenaltyArea(b.pos, 'left')).toBe(false);
    expect(pieces.find((p) => p.id === 'home-gk')).toEqual(base.find((p) => p.id === 'home-gk'));
  });

  it('moves buttons out of the area even when they are stacked, without re-entering it', () => {
    let base = start();
    for (const id of ['home-1', 'home-2', 'home-3', 'away-3']) base = move(base, id, 80, 320);
    base = move(move(base, 'away-2', 100, 200), 'home-4', 100, 200);
    const { pieces, kickerId } = placePenalty(base, 'home', 1, 'away');
    const others = buttons(pieces).filter((p) => p.id !== kickerId);
    for (const b of others) expect(isInPenaltyArea(b.pos, 'left')).toBe(false);
    expect(minPairGap(pieces)).toBeGreaterThanOrEqual(PIECE.buttonRadius * 2);
    expect(get(pieces, kickerId).pos).toEqual(vec(150, 320));
  });

  it('works on the right side', () => {
    const { ball, pieces, kickerId } = placePenalty(start(), 'home', 2, 'away');
    expect(ball).toEqual(vec(890, 320));
    expect(get(pieces, kickerId).pos).toEqual(vec(850, 320));
  });
});

describe('restart points', () => {
  it('computes corner and goal-kick points', () => {
    expect(cornerPoint('right', 600)).toEqual(vec(990, 630));
    expect(cornerPoint('left', 100)).toEqual(vec(10, 10));
    expect(goalKickPoint('left')).toEqual(vec(60, 320));
    expect(goalKickPoint('right')).toEqual(vec(940, 320));
  });
});
