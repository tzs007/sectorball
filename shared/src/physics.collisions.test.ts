import { describe, expect, it } from 'vitest';
import { CENTER, PIECE, SHOT } from './constants.ts';
import { formation } from './field.ts';
import { distance, vec } from './geometry.ts';
import type { Vec } from './geometry.ts';
import { shotVelocity, simulate } from './physics.ts';
import type { Piece, PieceId } from './types.ts';

const piece = (id: PieceId, x: number, y: number): Piece => ({
  id,
  team: id.startsWith('home') ? 'home' : 'away',
  kind: id.endsWith('gk') ? 'keeper' : 'button',
  pos: vec(x, y),
});

const scene = (pieces: readonly Piece[], ball: Vec) => ({
  shoot: (shooterId: PieceId, velocity: Vec) => simulate(pieces, ball, shooterId, velocity),
});

const FULL_PLUS_X = shotVelocity(vec(-SHOT.maxPull, 0));
const FULL_PLUS_Y = shotVelocity(vec(0, -SHOT.maxPull));
const centre = vec(CENTER.x, CENTER.y);

describe('simulate (collisions, goals and outs)', () => {
  it('head-on button hits the ball and the ball moves on', () => {
    const result = scene([piece('home-4', 400, 320)], vec(440, 320)).shoot('home-4', FULL_PLUS_X);
    const first = result.contacts[0];
    expect([first?.a, first?.b].sort()).toEqual(['ball', 'home-4']);
    // midway between the surfaces: next to the ball's left edge, on the line of centres
    expect(Math.abs((first?.at.x ?? NaN) - (440 - PIECE.ballRadius))).toBeLessThan(5);
    expect(first?.at.y).toBe(320);
    expect(result.ball.x).toBeGreaterThan(500);
  });

  it('ball into the right goal between the posts', () => {
    const result = scene([piece('home-4', 910, 320)], vec(950, 320)).shoot('home-4', FULL_PLUS_X);
    expect(result.ballExit?.kind).toBe('goal');
    expect(result.ballExit?.side).toBe('right');
    expect(result.ballLeftCenterCircle).toBe(true);
  });

  it('ball wide of the post is out over the goal line', () => {
    const result = scene([piece('home-4', 910, 100)], vec(950, 100)).shoot('home-4', FULL_PLUS_X);
    expect(result.ballExit).toMatchObject({ kind: 'out', line: 'goalline', side: 'right' });
  });

  it('ball over the touchline', () => {
    const result = scene([piece('home-4', 500, 600)], vec(500, 620)).shoot('home-4', FULL_PLUS_Y);
    expect(result.ballExit).toMatchObject({ kind: 'out', line: 'touchline' });
    expect(result.ballExit?.at.y).toBe(640);
    expect(result.ball).toEqual(result.ballExit?.at);
    expect(result.frames[result.frames.length - 1]?.ball).toEqual([result.ball.x, result.ball.y]);
  });

  it('keeper blocks a centred shot', () => {
    const keeper = piece('away-gk', 991, 320);
    const result = scene([piece('home-4', 860, 320), keeper], vec(900, 320)).shoot('home-4', FULL_PLUS_X);
    expect(result.ballExit?.kind).not.toBe('goal');
    expect(result.contacts).toContainEqual(expect.objectContaining({ a: 'ball', b: 'away-gk' }));
    expect(result.pieces[1]).toEqual(keeper);
  });

  it('a ball hitting the post bounces back into play', () => {
    const result = scene([piece('home-4', 910, 240)], vec(950, 240)).shoot('home-4', FULL_PLUS_X);
    expect(result.contacts).toContainEqual(expect.objectContaining({ a: 'ball', b: 'post' }));
    expect(result.ballExit).toBeNull();
    expect(result.ball.x).toBeLessThan(1000);
  });

  it('ballLeftCenterCircle is false for a tiny tap at the centre', () => {
    const result = scene([piece('home-5', 467, 320)], centre).shoot('home-5', shotVelocity(vec(-SHOT.minPull, 0)));
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.ballLeftCenterCircle).toBe(false);
  });

  it('ballLeftCenterCircle is true for a full-power kickoff', () => {
    const result = scene([piece('home-5', 465, 320)], centre).shoot('home-5', FULL_PLUS_X);
    expect(result.ballLeftCenterCircle).toBe(true);
  });

  it.each([
    ['nearly coincident', 1],
    ['exactly coincident', 0],
  ])('separates initially overlapping bodies without NaN (%s)', (_name, offset) => {
    // no shot speed: only the push-out can separate them
    const result = scene([piece('home-1', 300, 320), piece('home-2', 300 + offset, 320)], vec(800, 100)).shoot(
      'home-1',
      vec(0, 0),
    );
    const [a, b] = result.pieces.map((p) => p.pos);
    for (const v of [a, b, result.ball]) {
      expect(Number.isFinite(v?.x)).toBe(true);
      expect(Number.isFinite(v?.y)).toBe(true);
    }
    expect(distance(a ?? vec(NaN, NaN), b ?? vec(NaN, NaN))).toBeGreaterThanOrEqual(2 * PIECE.buttonRadius - 0.5);
  });

  it('is deterministic', () => {
    const pieces = [...formation('home', 1, true), ...formation('away', 1, false)];
    const run = () => simulate(pieces, centre, 'home-5', FULL_PLUS_X);
    expect(run()).toEqual(run());
  });
});
