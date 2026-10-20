import { describe, expect, it } from 'vitest';
import { SHOT, vec } from '@sectorball/shared';
import { aimGeometry } from './aim';

describe('aimGeometry', () => {
  it('computes band, arrow tip and power', () => {
    expect(aimGeometry(vec(100, 100), vec(-80, 0))).toEqual({
      band: vec(20, 100),
      direction: vec(220, 100),
      power: 0.5,
    });
  });

  it('clamps pulls longer than maxPull', () => {
    const g = aimGeometry(vec(100, 100), vec(-400, 0));
    expect(g.power).toBe(1);
    expect(g.band).toEqual(vec(100 - SHOT.maxPull, 100));
    expect(g.direction).toEqual(vec(100 + SHOT.maxPull * 1.5, 100));
  });
});
