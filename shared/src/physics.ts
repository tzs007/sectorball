import { CENTER, FIELD, GOAL, PHYSICS, PIECE, SHOT } from './constants.ts';
import { clampToField, goalLineX } from './field.ts';
import { add, distance, dot, length, normalize, scale, sub, vec } from './geometry.ts';
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

type Body = {
  readonly id: string;
  readonly radius: number;
  readonly invMass: number;
  readonly decel: number;
  pos: Vec;
  vel: Vec;
};

/** A static shape the body overlaps: push-out normal (towards the body), depth and the closest point on the shape. */
type StaticHit = { readonly normal: Vec; readonly depth: number; readonly at: Vec };

/** Used when two centres coincide exactly, so the normal is never NaN. */
const FALLBACK_NORMAL = vec(1, 0);

const POSTS: readonly Vec[] = (['left', 'right'] as const).flatMap((side) => [
  vec(goalLineX(side), GOAL.mouthTop),
  vec(goalLineX(side), GOAL.mouthBottom),
]);

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

/** Separates two overlapping circles; returns the contact point when an impulse was applied. */
const collideCircles = (a: Body, b: Body): Vec | null => {
  const delta = sub(b.pos, a.pos);
  const d = length(delta);
  const minDist = a.radius + b.radius;
  if (d >= minDist) return null;
  const n = d === 0 ? FALLBACK_NORMAL : scale(delta, 1 / d);
  const at = scale(add(add(a.pos, scale(n, a.radius)), sub(b.pos, scale(n, b.radius))), 0.5);
  const invSum = a.invMass + b.invMass;
  const overlap = minDist - d;
  a.pos = sub(a.pos, scale(n, (overlap * a.invMass) / invSum));
  b.pos = add(b.pos, scale(n, (overlap * b.invMass) / invSum));
  const approach = dot(sub(b.vel, a.vel), n);
  if (approach >= 0) return null;
  const j = (-(1 + PHYSICS.restitution) * approach) / invSum;
  a.vel = sub(a.vel, scale(n, j * a.invMass));
  b.vel = add(b.vel, scale(n, j * b.invMass));
  return at;
};

/** Pushes a body out of a static shape and reflects its normal velocity; returns true when it bounced. */
const bounceOff = (body: Body, hit: StaticHit, restitution: number): boolean => {
  body.pos = add(body.pos, scale(hit.normal, hit.depth));
  const vn = dot(body.vel, hit.normal);
  if (vn >= 0) return false;
  body.vel = sub(body.vel, scale(hit.normal, (1 + restitution) * vn));
  return true;
};

const postHit = (body: Body, post: Vec): StaticHit | null => {
  const delta = sub(body.pos, post);
  const d = length(delta);
  if (d >= body.radius + GOAL.postRadius) return null;
  const normal = d === 0 ? FALLBACK_NORMAL : scale(delta, 1 / d);
  return { normal, depth: body.radius + GOAL.postRadius - d, at: add(post, scale(normal, GOAL.postRadius)) };
};

const keeperHit = (body: Body, keeper: Vec): StaticHit | null => {
  const half = vec(PIECE.keeperWidth / 2, PIECE.keeperHeight / 2);
  const rel = sub(body.pos, keeper);
  const closest = vec(Math.max(-half.x, Math.min(half.x, rel.x)), Math.max(-half.y, Math.min(half.y, rel.y)));
  const delta = sub(rel, closest);
  const d = length(delta);
  if (d > 0) {
    return d < body.radius ? { normal: scale(delta, 1 / d), depth: body.radius - d, at: add(keeper, closest) } : null;
  }
  // centre inside the rectangle: leave through the nearest face
  const gap = vec(half.x - Math.abs(rel.x), half.y - Math.abs(rel.y));
  const sign = (n: number): number => (n < 0 ? -1 : 1);
  return gap.x <= gap.y
    ? { normal: vec(sign(rel.x), 0), depth: gap.x + body.radius, at: add(keeper, vec(sign(rel.x) * half.x, rel.y)) }
    : { normal: vec(0, sign(rel.y)), depth: gap.y + body.radius, at: add(keeper, vec(rel.x, sign(rel.y) * half.y)) };
};

/** Exit when the ball centre is more than one radius beyond a line; `at` is the centre clamped onto the field. */
const ballExitOf = (p: Vec): BallExit | null => {
  const r = PIECE.ballRadius;
  const at = clampToField(p);
  if (p.x < -r || p.x > FIELD.width + r) {
    const side: Side = p.x < 0 ? 'left' : 'right';
    return p.y > GOAL.mouthTop && p.y < GOAL.mouthBottom
      ? { kind: 'goal', side, at }
      : { kind: 'out', line: 'goalline', side, at };
  }
  if (p.y < -r || p.y > FIELD.height + r) {
    return { kind: 'out', line: 'touchline', side: p.x < FIELD.width / 2 ? 'left' : 'right', at };
  }
  return null;
};

export const simulate = (pieces: readonly Piece[], ball: Vec, shooterId: PieceId, velocity: Vec): SimResult => {
  const movers: Body[] = pieces
    .filter((p) => p.kind === 'button')
    .map((p) => ({
      id: p.id,
      radius: PIECE.buttonRadius,
      invMass: 1 / PHYSICS.buttonMass,
      decel: PHYSICS.buttonDecel,
      pos: p.pos,
      vel: p.id === shooterId ? velocity : vec(0, 0),
    }));
  const keepers = pieces.filter((p) => p.kind === 'keeper');
  const ballBody: Body = {
    id: 'ball',
    radius: PIECE.ballRadius,
    invMass: 1 / PHYSICS.ballMass,
    decel: PHYSICS.ballDecel,
    pos: ball,
    vel: vec(0, 0),
  };
  const bodies: Body[] = [...movers, ballBody];
  let active: Body[] = bodies;

  const frames: Frame[] = [];
  const contacts: Contact[] = [];
  let ballExit: BallExit | null = null;
  let ballLeftCenterCircle = false;

  for (let step = 1; step <= PHYSICS.maxSteps; step++) {
    for (const body of active) integrate(body);

    active.forEach((a, i) => {
      for (const b of active.slice(i + 1)) {
        const at = collideCircles(a, b);
        if (at) contacts.push({ step, a: a.id, b: b.id, at });
      }
    });
    for (const body of active) {
      for (const keeper of keepers) {
        const hit = keeperHit(body, keeper.pos);
        if (hit && bounceOff(body, hit, PHYSICS.keeperRestitution)) {
          contacts.push({ step, a: body.id, b: keeper.id, at: hit.at });
        }
      }
      for (const post of POSTS) {
        const hit = postHit(body, post);
        if (hit && bounceOff(body, hit, PHYSICS.postRestitution)) {
          contacts.push({ step, a: body.id, b: 'post', at: hit.at });
        }
      }
    }

    if (!ballExit) {
      ballExit = ballExitOf(ballBody.pos);
      if (ballExit) {
        // the ball leaves the simulation and rests at its exit point
        ballBody.pos = ballExit.at;
        ballBody.vel = vec(0, 0);
        active = movers;
      }
    }
    ballLeftCenterCircle ||= ballExit !== null || distance(ballBody.pos, CENTER) > CENTER.circleRadius;

    const done = step === PHYSICS.maxSteps || active.every((b) => length(b.vel) < PHYSICS.stopSpeed);
    if (done) break;
    if (step % PHYSICS.frameEvery === 0) frames.push(snapshot(bodies));
  }

  for (const body of movers) body.pos = clampToField(body.pos);
  frames.push(snapshot(bodies));

  const finalPos = new Map(movers.map((b) => [b.id, b.pos]));
  return {
    frames,
    contacts,
    ballExit,
    ballLeftCenterCircle,
    pieces: pieces.map((p) => ({ ...p, pos: finalPos.get(p.id) ?? p.pos })),
    ball: ballBody.pos,
  };
};
