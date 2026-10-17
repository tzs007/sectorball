import { describe, expect, it } from 'vitest';
import { CENTER } from './constants.ts';
import {
  clampKeeperY,
  clampToField,
  defendedSide,
  formation,
  isInAttackingHalf,
  isInPenaltyArea,
  isInsideField,
  keeperX,
  ownerOfSide,
  penaltySpot,
} from './field.ts';
import { distance, vec } from './geometry.ts';

describe('field helpers', () => {
  it.each([
    ['home', 1, 'left'],
    ['away', 1, 'right'],
    ['home', 2, 'right'],
    ['away', 2, 'left'],
  ] as const)('defendedSide(%s, %i) is %s and ownerOfSide inverts it', (team, half, side) => {
    expect(defendedSide(team, half)).toBe(side);
    expect(ownerOfSide(side, half)).toBe(team);
  });

  it("halfway line belongs to nobody's attacking half", () => {
    expect(isInAttackingHalf(vec(500, 320), 'home', 1)).toBe(false);
    expect(isInAttackingHalf(vec(500, 320), 'away', 1)).toBe(false);
    expect(isInAttackingHalf(vec(501, 320), 'home', 1)).toBe(true);
    expect(isInAttackingHalf(vec(501, 320), 'home', 2)).toBe(false);
    expect(isInAttackingHalf(vec(499, 320), 'away', 1)).toBe(true);
  });

  it('penalty area is an inclusive box', () => {
    expect(isInPenaltyArea(vec(150, 140), 'left')).toBe(true);
    expect(isInPenaltyArea(vec(151, 320), 'left')).toBe(false);
    expect(isInPenaltyArea(vec(900, 320), 'right')).toBe(true);
    expect(isInPenaltyArea(vec(850, 500), 'right')).toBe(true);
    expect(isInPenaltyArea(vec(849, 320), 'right')).toBe(false);
  });

  it('penalty spots and keeper lines', () => {
    expect(penaltySpot('left')).toEqual(vec(110, 320));
    expect(penaltySpot('right')).toEqual(vec(890, 320));
    expect(keeperX('left')).toBe(9);
    expect(keeperX('right')).toBe(991);
  });

  it('clamps keeper y and field positions', () => {
    expect(clampKeeperY(100)).toBe(240);
    expect(clampKeeperY(999)).toBe(400);
    expect(clampKeeperY(300)).toBe(300);
    expect(clampToField(vec(-20, 700))).toEqual(vec(0, 640));
    expect(isInsideField(vec(0, 640))).toBe(true);
    expect(isInsideField(vec(1000.5, 10))).toBe(false);
  });
});

describe('formation', () => {
  it('builds the away kickoff formation mirrored on the right', () => {
    const pieces = formation('away', 1, true);
    expect(pieces.map((p) => p.id)).toEqual(['away-1', 'away-2', 'away-3', 'away-4', 'away-5', 'away-gk']);
    expect(pieces.map((p) => p.kind)).toEqual(['button', 'button', 'button', 'button', 'button', 'keeper']);
    expect(pieces.find((p) => p.id === 'away-5')?.pos).toEqual(vec(535, 320));
    expect(pieces.find((p) => p.id === 'away-gk')?.pos).toEqual(vec(991, 320));
    expect(pieces.filter((p) => p.kind === 'button').every((p) => p.pos.x >= 500)).toBe(true);
  });

  it('uses the left layout for home in half 1 and swaps in half 2', () => {
    const left = formation('home', 1, false);
    expect(left[1]?.pos).toEqual(vec(260, 170));
    expect(left[5]?.pos).toEqual(vec(9, 320));
    expect(formation('home', 2, false)[0]?.pos).toEqual(vec(850, 320));
  });

  it('keeps non-kickoff buttons outside the centre circle', () => {
    for (const p of formation('home', 1, false).filter((q) => q.kind === 'button')) {
      expect(distance(p.pos, CENTER)).toBeGreaterThan(CENTER.circleRadius);
    }
  });
});
