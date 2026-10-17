import { CENTER, FIELD, PENALTY_AREA, PIECE, RESTART } from './constants.ts';
import { clampToField, defendedSide, goalLineX, isInPenaltyArea, penaltySpot } from './field.ts';
import type { Vec } from './geometry.ts';
import { add, distance, scale, sub, vec } from './geometry.ts';
import type { Piece, PieceId, Side, Team } from './types.ts';

type Half = 1 | 2;
export type Layout = { pieces: Piece[]; ball: Vec };

const MAX_PASSES = 20;
const GAP = 1;
const BUTTON_SEPARATION = PIECE.buttonRadius * 2 + GAP;
const BALL_SEPARATION = PIECE.buttonRadius + PIECE.ballRadius + GAP;
const FALLBACK_DIRECTION = vec(1, 0);
const FIELD_CENTER = vec(CENTER.x, CENTER.y);

const withPos = (piece: Piece, pos: Vec): Piece => ({ ...piece, pos });
const isButton = (piece: Piece): boolean => piece.kind === 'button';

/** Unit vector pointing from `from` to `to`; coincident points fall back to away-from-centre, then +x. */
const directionAway = (from: Vec, to: Vec): Vec => {
  for (const origin of [from, FIELD_CENTER]) {
    const d = distance(origin, to);
    if (d > 0) return scale(sub(to, origin), 1 / d);
  }
  return FALLBACK_DIRECTION;
};

/** Move `moving` along the line from `anchor` until their centres are `target` apart. */
const pushAway = (anchor: Vec, moving: Vec, target: number): Vec =>
  clampToField(add(anchor, scale(directionAway(anchor, moving), target)));

type Clearance = (piece: Piece) => number;
const ballClearance: Clearance = () => BALL_SEPARATION;

/** `clearance` gives the minimum centre distance from the ball per button (0 disables the check). */
const separate = (pieces: readonly Piece[], ball: Vec, fixed: ReadonlySet<PieceId>, clearance: Clearance): Piece[] => {
  const result = [...pieces];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    result.forEach((p, i) => {
      const minDistance = clearance(p);
      if (!isButton(p) || fixed.has(p.id) || distance(p.pos, ball) >= minDistance) return;
      result[i] = withPos(p, pushAway(ball, p.pos, minDistance));
      changed = true;
    });
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
    if (!changed) break;
  }
  return result.map((p) => withPos(p, clampToField(p.pos)));
};

/**
 * Push overlapping buttons apart and (when `fixedBall`) away from the ball. Keepers and the ball
 * never move; the result is clamped into the field.
 */
export const resolveOverlaps = (pieces: readonly Piece[], ball: Vec, fixedBall: boolean): Piece[] =>
  separate(pieces, ball, new Set(), fixedBall ? ballClearance : () => 0);

/** Also used for throw-ins and corners (`at` = line point / corner point). */
export const placeFreeKick = (pieces: readonly Piece[], at: Vec, awardedTo: Team): Layout => {
  const ball = clampToField(at);
  const pushed = pieces.map((p) =>
    isButton(p) && p.team !== awardedTo && distance(p.pos, ball) < RESTART.freeKickDistance
      ? withPos(p, pushAway(ball, p.pos, RESTART.freeKickDistance))
      : p,
  );
  const clearance: Clearance = (p) => (p.team === awardedTo ? BALL_SEPARATION : RESTART.freeKickDistance);
  return { pieces: separate(pushed, ball, new Set(), clearance), ball };
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
  const outsideX =
    side === 'left' ? PENALTY_AREA.depth + PIECE.buttonRadius : FIELD.width - PENALTY_AREA.depth - PIECE.buttonRadius;

  const kicker = pieces
    .filter((p) => isButton(p) && p.team === kickerTeam)
    .reduce((best, p) => (distance(p.pos, spot) < distance(best.pos, spot) ? p : best));
  const kickerPos = vec(spot.x + towardCenter * RESTART.penaltyKickerOffset, spot.y);

  const placed = pieces.map((p) => {
    if (p.id === kicker.id) return withPos(p, kickerPos);
    return isButton(p) && isInPenaltyArea(p.pos, side) ? withPos(p, vec(outsideX, p.pos.y)) : p;
  });
  return {
    pieces: separate(placed, spot, new Set([kicker.id]), ballClearance),
    ball: spot,
    kickerId: kicker.id,
  };
};
