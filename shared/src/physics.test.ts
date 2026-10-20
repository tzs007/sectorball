import { describe, expect, it } from 'vitest';
import { CENTER, PHYSICS } from './constants.ts';
import { clampToField } from './field.ts';
import { vec } from './geometry.ts';
import { shotVelocity, simulate } from './physics.ts';
import type { Piece } from './types.ts';

const button = (id: Piece['id'], x: number, y: number): Piece => ({
  id,
  team: id.startsWith('home') ? 'home' : 'away',
  kind: 'button',
  pos: vec(x, y),
});

const round1 = (n: number): number => Math.round(n * 10) / 10;

describe('shotVelocity', () => {
  it('points opposite to the pull, scaled by pull length', () => {
    expect(shotVelocity(vec(-100, 0))).toEqual(vec(687.5, 0));
  });

  it('caps the speed at the maximum pull', () => {
    expect(shotVelocity(vec(0, 1000))).toEqual(vec(0, -1100));
  });
});

describe('simulate (free movement)', () => {
  const pieces = [button('home-1', 100, 320)];
  // ball on the centre spot, out of the lone button's reach
  const ball = vec(CENTER.x, CENTER.y);
  const expectedX = 100 + 687.5 ** 2 / (2 * PHYSICS.buttonDecel);

  it('a lone button slides opposite to the pull and stops', () => {
    const result = simulate(pieces, ball, 'home-1', shotVelocity(vec(-100, 0)));
    const final = result.pieces[0];
    expect(final?.pos.x).toBeGreaterThan(expectedX - 5);
    expect(final?.pos.x).toBeLessThan(expectedX + 5);
    expect(final?.pos.y).toBe(320);
    expect(result.contacts).toEqual([]);
    expect(result.ballExit).toBeNull();
    expect(result.ballLeftCenterCircle).toBe(false);
    const last = result.frames[result.frames.length - 1];
    expect(last?.['home-1']).toEqual([round1(final?.pos.x ?? NaN), round1(final?.pos.y ?? NaN)]);
    expect(last?.ball).toEqual([round1(result.ball.x), round1(result.ball.y)]);
  });

  it('frames are sampled at 60 fps', () => {
    const result = simulate(pieces, ball, 'home-1', shotVelocity(vec(-160, 0)));
    expect(result.frames.length).toBeGreaterThan(50);
    for (const frame of result.frames) expect(Object.keys(frame).sort()).toEqual(['ball', 'home-1']);
  });

  it('keeps keepers fixed and excludes them from frames', () => {
    const keeper: Piece = { id: 'away-gk', team: 'away', kind: 'keeper', pos: vec(950, 320) };
    const result = simulate([...pieces, keeper], ball, 'home-1', shotVelocity(vec(-100, 0)));
    expect(result.pieces[1]).toEqual(keeper);
    expect(result.frames[0]).not.toHaveProperty('away-gk');
  });

  it('clamps buttons that end outside the field', () => {
    const result = simulate(pieces, ball, 'home-1', shotVelocity(vec(100, 0)));
    const pos = result.pieces[0]?.pos ?? vec(NaN, NaN);
    expect(pos).toEqual(clampToField(pos));
    expect(pos.x).toBe(0);
  });

  it('the final frame equals the clamped rest positions', () => {
    const result = simulate(pieces, ball, 'home-1', shotVelocity(vec(100, 0)));
    const pos = result.pieces[0]?.pos ?? vec(NaN, NaN);
    expect(result.frames[result.frames.length - 1]).toEqual({ 'home-1': [pos.x, pos.y], ball: [ball.x, ball.y] });
  });

  it('does not mutate its inputs', () => {
    const frozenPieces = Object.freeze(pieces.map((p) => Object.freeze({ ...p, pos: Object.freeze({ ...p.pos }) })));
    const frozenBall = Object.freeze({ ...ball });
    const before = JSON.stringify([frozenPieces, frozenBall]);
    simulate(frozenPieces, frozenBall, 'home-1', Object.freeze(shotVelocity(vec(-100, 0))));
    expect(JSON.stringify([frozenPieces, frozenBall])).toBe(before);
  });
});
