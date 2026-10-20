import { describe, expect, it } from 'vitest';
import { clampLength, isFiniteVec, normalize, vec } from './geometry.ts';

describe('geometry', () => {
  it('normalize keeps direction and returns zero for the zero vector', () => {
    expect(normalize(vec(3, 4))).toEqual(vec(0.6, 0.8));
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0));
  });
  it('clampLength caps only longer vectors', () => {
    expect(clampLength(vec(300, 400), 100)).toEqual(vec(60, 80));
    expect(clampLength(vec(3, 4), 100)).toEqual(vec(3, 4));
  });
  it('isFiniteVec rejects NaN and Infinity', () => {
    expect(isFiniteVec(vec(1, 2))).toBe(true);
    expect(isFiniteVec(vec(Number.NaN, 0))).toBe(false);
    expect(isFiniteVec(vec(0, Infinity))).toBe(false);
  });
});
