import { describe, expect, it } from 'vitest';
import { FIELD, PIECE, RESTART } from './constants.ts';
import { formation, isInsideField } from './field.ts';
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
      expect(distance(b.pos, ball)).toBeGreaterThanOrEqual(PIECE.buttonRadius + PIECE.ballRadius);
      expect(isInsideField(b.pos)).toBe(true);
    }
    expect(minPairGap(pieces)).toBeGreaterThanOrEqual(PIECE.buttonRadius * 2);
  });

  it('handles a button exactly on the ball without NaN and never moves keepers', () => {
    const base = move(start(), 'away-3', 300, 300);
    const out = resolveOverlaps(base, vec(300, 300), true);
    const moved = get(out, 'away-3');
    expect(Number.isFinite(moved.pos.x) && Number.isFinite(moved.pos.y)).toBe(true);
    expect(distance(moved.pos, vec(300, 300))).toBeGreaterThanOrEqual(PIECE.buttonRadius + PIECE.ballRadius);
    expect(out.find((p) => p.id === 'home-gk')).toEqual(base.find((p) => p.id === 'home-gk'));
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
      expect(b.pos.x <= 150 && b.pos.y >= 140 && b.pos.y <= 500).toBe(false);
    expect(pieces.find((p) => p.id === 'home-gk')).toEqual(base.find((p) => p.id === 'home-gk'));
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
