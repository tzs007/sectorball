import { CENTER, FIELD, GOAL, PENALTY_AREA, PENALTY_SPOT_DISTANCE, PIECE } from './constants.ts';
import type { Vec } from './geometry.ts';
import { vec } from './geometry.ts';
import type { Piece, PieceId, Side, Team } from './types.ts';

type Half = 1 | 2;

const HALFWAY = FIELD.width / 2;

/** Formation for the left side (buttons 1-5); the right side mirrors x. */
const BUTTON_SLOTS: readonly Vec[] = [vec(150, 320), vec(260, 170), vec(260, 470), vec(400, 250), vec(400, 390)];
const KICKOFF_BUTTON_5 = vec(465, 320);

export const defendedSide = (team: Team, half: Half): Side =>
  (team === 'home') === (half === 1) ? 'left' : 'right';

export const ownerOfSide = (side: Side, half: Half): Team => (defendedSide('home', half) === side ? 'home' : 'away');

export const goalLineX = (side: Side): number => (side === 'left' ? 0 : FIELD.width);

/** Strictly beyond the halfway line toward the opponent goal. */
export const isInAttackingHalf = (pos: Vec, team: Team, half: Half): boolean =>
  defendedSide(team, half) === 'left' ? pos.x > HALFWAY : pos.x < HALFWAY;

export const isInPenaltyArea = (pos: Vec, side: Side): boolean => {
  const inX = side === 'left' ? pos.x <= PENALTY_AREA.depth : pos.x >= FIELD.width - PENALTY_AREA.depth;
  return inX && pos.x >= 0 && pos.x <= FIELD.width && pos.y >= PENALTY_AREA.top && pos.y <= PENALTY_AREA.bottom;
};

export const penaltySpot = (side: Side): Vec =>
  vec(side === 'left' ? PENALTY_SPOT_DISTANCE : FIELD.width - PENALTY_SPOT_DISTANCE, CENTER.y);

export const keeperX = (side: Side): number =>
  side === 'left' ? PIECE.keeperLineOffset : FIELD.width - PIECE.keeperLineOffset;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const clampKeeperY = (y: number): number => clamp(y, GOAL.mouthTop, GOAL.mouthBottom);

export const isInsideField = (pos: Vec): boolean =>
  pos.x >= 0 && pos.x <= FIELD.width && pos.y >= 0 && pos.y <= FIELD.height;

export const clampToField = (pos: Vec): Vec => vec(clamp(pos.x, 0, FIELD.width), clamp(pos.y, 0, FIELD.height));

export const formation = (team: Team, half: Half, kickoff: boolean): Piece[] => {
  const side = defendedSide(team, half);
  const place = (p: Vec): Vec => (side === 'left' ? p : vec(FIELD.width - p.x, p.y));
  const buttons = BUTTON_SLOTS.map(
    (slot, i): Piece => ({
      id: `${team}-${i + 1}` as PieceId,
      team,
      kind: 'button',
      pos: place(kickoff && i === 4 ? KICKOFF_BUTTON_5 : slot),
    }),
  );
  const keeper: Piece = { id: `${team}-gk`, team, kind: 'keeper', pos: vec(keeperX(side), CENTER.y) };
  return [...buttons, keeper];
};
