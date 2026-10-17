import { CENTER, FIELD, PENALTY_AREA, PIECE, RESTART } from './constants.ts';
import { clampToField, defendedSide, goalLineX, isInsideField, penaltySpot } from './field.ts';
import type { Vec } from './geometry.ts';
import { add, distance, scale, sub, vec } from './geometry.ts';
import type { Piece, PieceId, Side, Team } from './types.ts';

type Half = 1 | 2;
export type Layout = { pieces: Piece[]; ball: Vec };

const MAX_PASSES = 20;
const GAP = 1;
const BUTTON_SEPARATION = PIECE.buttonRadius * 2 + GAP;
const BALL_SEPARATION = PIECE.buttonRadius + PIECE.ballRadius + GAP;
const KEEPER_SEPARATION = PIECE.buttonRadius + GAP;
const KEEPER_HALF = vec(PIECE.keeperWidth / 2, PIECE.keeperHeight / 2);
const FALLBACK_DIRECTION = vec(1, 0);
const FIELD_CENTER = vec(CENTER.x, CENTER.y);

const withPos = (piece: Piece, pos: Vec): Piece => ({ ...piece, pos });
const isButton = (piece: Piece): boolean => piece.kind === 'button';

/** Unit vector from `from` to `to`; coincident points fall back to toward-field-centre, then +x. */
const directionAway = (from: Vec, to: Vec): Vec => {
  for (const [origin, target] of [
    [from, to],
    [to, FIELD_CENTER],
  ] as const) {
    const d = distance(origin, target);
    if (d > 0) return scale(sub(target, origin), 1 / d);
  }
  return FALLBACK_DIRECTION;
};

/** Move `moving` along the line from `anchor` until their centres are `target` apart (clamped into the field). */
const pushAway = (anchor: Vec, moving: Vec, target: number): Vec =>
  clampToField(add(anchor, scale(directionAway(anchor, moving), target)));

type Clearance = (piece: Piece) => number;
const ballClearance: Clearance = () => BALL_SEPARATION;

/** Minimum clearance is met up to float rounding; candidates are generated slightly outside the circle. */
const CIRCLE_MARGIN = 1 + 1e-9;

/** Distance from `pos` to the keeper rectangle centred on `keeper` (0 inside it). */
const keeperGap = (pos: Vec, keeper: Vec): number =>
  Math.hypot(
    Math.max(0, Math.abs(pos.x - keeper.x) - KEEPER_HALF.x),
    Math.max(0, Math.abs(pos.y - keeper.y) - KEEPER_HALF.y),
  );

/** Nearest points to `pos` that clear the keeper rectangle: straight out of each face and radially off the closest point. */
const keeperExits = (pos: Vec, keeper: Vec): Vec[] => {
  const dx = KEEPER_HALF.x + KEEPER_SEPARATION;
  const dy = KEEPER_HALF.y + KEEPER_SEPARATION;
  const closest = vec(
    Math.min(keeper.x + KEEPER_HALF.x, Math.max(keeper.x - KEEPER_HALF.x, pos.x)),
    Math.min(keeper.y + KEEPER_HALF.y, Math.max(keeper.y - KEEPER_HALF.y, pos.y)),
  );
  return [
    vec(keeper.x - dx, pos.y),
    vec(keeper.x + dx, pos.y),
    vec(pos.x, keeper.y - dy),
    vec(pos.x, keeper.y + dy),
    add(closest, scale(directionAway(closest, pos), KEEPER_SEPARATION * CIRCLE_MARGIN)),
  ];
};

type Rules = {
  readonly ball: Vec;
  readonly fixed: ReadonlySet<PieceId>;
  /** Minimum centre distance from the ball per button (0 disables the check). */
  readonly clearance: Clearance;
  /** Side whose penalty area non-fixed buttons must stay out of. */
  readonly keepOut?: Side;
};

const outsideAreaX = (side: Side): number =>
  side === 'left' ? PENALTY_AREA.depth + PIECE.buttonRadius : FIELD.width - PENALTY_AREA.depth - PIECE.buttonRadius;

const inKeepOut = (pos: Vec, side: Side): boolean =>
  pos.y >= PENALTY_AREA.top &&
  pos.y <= PENALTY_AREA.bottom &&
  (side === 'left' ? pos.x < outsideAreaX(side) : pos.x > outsideAreaX(side));

/** Points where the circle (centre `ball`, radius `r`) meets the vertical (`x`) or horizontal (`y`) line. */
const circleLineHits = (ball: Vec, r: number, axis: 'x' | 'y', value: number): Vec[] => {
  const other = axis === 'x' ? 'y' : 'x';
  const d = value - ball[axis];
  const h2 = r * r - d * d;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  return [-h, h].map((o) => (axis === 'x' ? vec(value, ball[other] + o) : vec(ball[other] + o, value)));
};

/**
 * Nearest in-field point to `pos` that is at least `minDistance` from the ball, clear of the keepers and
 * outside the keep-out area. Candidates: radial push, area edge, keeper exits, clamped position, and
 * circle/line intersections along the field boundary and the area edge (so a radial target outside the
 * field slides along the boundary).
 */
const nearestAllowed = (pos: Vec, rules: Rules, keepers: readonly Vec[], minDistance: number): Vec => {
  const { ball, keepOut } = rules;
  const r = minDistance * CIRCLE_MARGIN;
  const allowed = (q: Vec): boolean =>
    isInsideField(q) &&
    distance(q, ball) >= minDistance &&
    keepers.every((k) => keeperGap(q, k) >= KEEPER_SEPARATION) &&
    !(keepOut && inKeepOut(q, keepOut));
  const candidates: Vec[] = [
    pos,
    clampToField(pos),
    add(ball, scale(directionAway(ball, pos), r)),
    ...circleLineHits(ball, r, 'x', 0),
    ...circleLineHits(ball, r, 'x', FIELD.width),
    ...circleLineHits(ball, r, 'y', 0),
    ...circleLineHits(ball, r, 'y', FIELD.height),
    ...keepers.flatMap((k) => keeperExits(pos, k)),
  ];
  if (keepOut) {
    const x = outsideAreaX(keepOut);
    candidates.push(vec(x, pos.y), ...circleLineHits(ball, r, 'x', x));
  }
  const valid = candidates.filter(allowed);
  if (valid.length === 0) return clampToField(pos);
  return valid.reduce((best, q) => (distance(q, pos) < distance(best, pos) ? q : best));
};

const enforce = (piece: Piece, rules: Rules, keepers: readonly Vec[]): Piece => {
  if (!isButton(piece) || rules.fixed.has(piece.id)) return piece;
  const target = nearestAllowed(piece.pos, rules, keepers, rules.clearance(piece));
  return target.x === piece.pos.x && target.y === piece.pos.y ? piece : withPos(piece, target);
};

/**
 * Alternate pair separation with enforcement of the per-piece rules (ball clearance, keeper clearance,
 * keep-out area); keepers are static obstacles.
 * Enforcement runs last in every pass, so the result always satisfies those rules; pair separation
 * is best-effort and can stay unmet only if the pieces cannot geometrically fit (or after MAX_PASSES).
 */
const separate = (pieces: readonly Piece[], rules: Rules): Piece[] => {
  const { fixed } = rules;
  const keepers = pieces.filter((p) => !isButton(p)).map((p) => p.pos);
  let result = [...pieces];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        if (!a || !b || !isButton(a) || !isButton(b)) continue;
        const gap = distance(a.pos, b.pos);
        if (gap >= BUTTON_SEPARATION) continue;
        const aFixed = fixed.has(a.id);
        const bFixed = fixed.has(b.id);
        if (aFixed && bFixed) continue;
        changed = true;
        if (aFixed) {
          result[j] = withPos(b, pushAway(a.pos, b.pos, BUTTON_SEPARATION));
        } else if (bFixed) {
          result[i] = withPos(a, pushAway(b.pos, a.pos, BUTTON_SEPARATION));
        } else {
          const half = scale(directionAway(a.pos, b.pos), (BUTTON_SEPARATION - gap) / 2);
          result[i] = withPos(a, clampToField(sub(a.pos, half)));
          result[j] = withPos(b, clampToField(add(b.pos, half)));
        }
      }
    }
    const enforced = result.map((p) => enforce(p, rules, keepers));
    changed ||= enforced.some((p, i) => p !== result[i]);
    result = enforced;
    if (!changed) break;
  }
  return result.map((p) => withPos(p, clampToField(p.pos)));
};

/**
 * Push overlapping buttons apart, off the keepers and (when `fixedBall`) away from the ball. Keepers and
 * the ball never move; the result is clamped into the field.
 */
export const resolveOverlaps = (pieces: readonly Piece[], ball: Vec, fixedBall: boolean): Piece[] =>
  separate(pieces, { ball, fixed: new Set(), clearance: fixedBall ? ballClearance : () => 0 });

/** Also used for throw-ins and corners (`at` = line point / corner point). */
export const placeFreeKick = (pieces: readonly Piece[], at: Vec, awardedTo: Team): Layout => {
  const ball = clampToField(at);
  const clearance: Clearance = (p) => (p.team === awardedTo ? BALL_SEPARATION : RESTART.freeKickDistance);
  return { pieces: separate(pieces, { ball, fixed: new Set(), clearance }), ball };
};

export const cornerPoint = (side: Side, exitY: number): Vec =>
  vec(
    side === 'left' ? PIECE.ballRadius : FIELD.width - PIECE.ballRadius,
    exitY < CENTER.y ? PIECE.ballRadius : FIELD.height - PIECE.ballRadius,
  );

export const goalKickPoint = (side: Side): Vec =>
  vec(goalLineX(side) + (side === 'left' ? RESTART.goalKickDistance : -RESTART.goalKickDistance), CENTER.y);

export const placePenalty = (
  pieces: readonly Piece[],
  foulingTeam: Team,
  half: Half,
  kickerTeam: Team,
): Layout & { kickerId: PieceId } => {
  const side = defendedSide(foulingTeam, half);
  const spot = penaltySpot(side);
  const towardCenter = side === 'left' ? 1 : -1;

  const kicker = pieces
    .filter((p) => isButton(p) && p.team === kickerTeam)
    .reduce((best, p) => (distance(p.pos, spot) < distance(best.pos, spot) ? p : best));
  const kickerPos = vec(spot.x + towardCenter * RESTART.penaltyKickerOffset, spot.y);

  const placed = pieces.map((p) => (p.id === kicker.id ? withPos(p, kickerPos) : p));
  const rules: Rules = { ball: spot, fixed: new Set([kicker.id]), clearance: ballClearance, keepOut: side };
  return {
    pieces: separate(placed, rules),
    ball: spot,
    kickerId: kicker.id,
  };
};
