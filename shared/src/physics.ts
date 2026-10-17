import { CENTER, PHYSICS, SHOT } from './constants.ts';
import { clampToField } from './field.ts';
import { add, distance, length, normalize, scale, vec } from './geometry.ts';
import type { Vec } from './geometry.ts';
import type { Frame, Piece, PieceId, Side } from './types.ts';

export type Contact = { readonly step: number; readonly a: string; readonly b: string; readonly at: Vec };

export type BallExit =
  | { readonly kind: 'goal'; readonly side: Side; readonly at: Vec }
  | { readonly kind: 'out'; readonly line: 'touchline' | 'goalline'; readonly side: Side; readonly at: Vec };

export type SimResult = {
  readonly frames: Frame[];
  readonly contacts: Contact[];
  readonly ballExit: BallExit | null;
  readonly ballLeftCenterCircle: boolean;
  readonly pieces: Piece[];
  readonly ball: Vec;
};

/** Initial velocity for a pull vector: opposite direction, speed proportional to the (capped) pull length. */
export const shotVelocity = (pull: Vec): Vec => {
  const speed = (Math.min(length(pull), SHOT.maxPull) / SHOT.maxPull) * PHYSICS.maxShotSpeed;
  const v = scale(normalize(pull), -speed);
  // `+ 0` turns -0 into 0
  return vec(v.x + 0, v.y + 0);
};

type Body = { readonly id: string; readonly decel: number; pos: Vec; vel: Vec };

const round1 = (n: number): number => Math.round(n * 10) / 10;

const snapshot = (bodies: readonly Body[]): Frame =>
  Object.fromEntries(bodies.map((b) => [b.id, [round1(b.pos.x), round1(b.pos.y)] as const]));

/** Moves a body by one step, then applies constant deceleration (never reversing direction). */
const integrate = (body: Body): void => {
  body.pos = add(body.pos, scale(body.vel, PHYSICS.dt));
  const speed = length(body.vel);
  if (speed === 0) return;
  body.vel = scale(body.vel, Math.max(0, speed - body.decel * PHYSICS.dt) / speed);
};

export const simulate = (pieces: readonly Piece[], ball: Vec, shooterId: PieceId, velocity: Vec): SimResult => {
  const movers: Body[] = pieces
    .filter((p) => p.kind === 'button')
    .map((p) => ({
      id: p.id,
      decel: PHYSICS.buttonDecel,
      pos: p.pos,
      vel: p.id === shooterId ? velocity : vec(0, 0),
    }));
  const ballBody: Body = { id: 'ball', decel: PHYSICS.ballDecel, pos: ball, vel: vec(0, 0) };
  const bodies: Body[] = [...movers, ballBody];

  const frames: Frame[] = [];
  const contacts: Contact[] = [];
  let ballLeftCenterCircle = false;

  for (let step = 1; step <= PHYSICS.maxSteps; step++) {
    for (const body of bodies) integrate(body);
    // Task 4: collision, goal and out handling is inserted here, after integration.
    ballLeftCenterCircle ||= distance(ballBody.pos, CENTER) > CENTER.circleRadius;
    if (step % PHYSICS.frameEvery === 0) frames.push(snapshot(bodies));
    if (bodies.every((b) => length(b.vel) < PHYSICS.stopSpeed)) break;
  }
  frames.push(snapshot(bodies));

  const finalPos = new Map(movers.map((b) => [b.id, clampToField(b.pos)]));
  return {
    frames,
    contacts,
    ballExit: null,
    ballLeftCenterCircle,
    pieces: pieces.map((p) => ({ ...p, pos: finalPos.get(p.id) ?? p.pos })),
    ball: ballBody.pos,
  };
};
