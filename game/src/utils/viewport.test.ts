import { describe, expect, it } from 'vitest';
import { FIELD, vec } from '@sectorball/shared';
import { fitToView, toScreen, toWorld, WORLD } from './viewport';

describe('viewport', () => {
  it.each([
    [800, 600],
    [1920, 1080],
    [375, 667],
  ])('toWorld inverts fitToView at %ix%i', (w, h) => {
    const fit = fitToView(w, h);
    const p = vec(500, 320);
    const back = toWorld(toScreen(p, fit), fit);
    expect(back.x).toBeCloseTo(500, 2);
    expect(back.y).toBeCloseTo(320, 2);

    expect(fit.x).toBeGreaterThanOrEqual(-1e-9);
    expect(fit.y).toBeGreaterThanOrEqual(-1e-9);
    expect(fit.x + WORLD.width * fit.scale).toBeLessThanOrEqual(w + 1e-9);
    expect(fit.y + WORLD.height * fit.scale).toBeLessThanOrEqual(h + 1e-9);
  });

  it('centres the world and offsets the pitch origin by the margin', () => {
    const fit = fitToView(WORLD.width * 2, WORLD.height * 2 + 100);
    expect(fit.scale).toBe(2);
    expect(fit.y).toBe(50);
    expect(toWorld(vec(fit.x + FIELD.margin * 2, fit.y + FIELD.margin * 2), fit)).toEqual(vec(0, 0));
  });
});
