import { add, clampLength, length, scale, sub, SHOT } from '@sectorball/shared';
import type { Vec } from '@sectorball/shared';

const ARROW_FACTOR = 1.5;

/** Rubber band end, arrow tip (toward the shot) and 0..1 power for a drag. */
export const aimGeometry = (from: Vec, pull: Vec): { band: Vec; direction: Vec; power: number } => {
  const clamped = clampLength(pull, SHOT.maxPull);
  return {
    band: add(from, clamped),
    direction: sub(from, scale(clamped, ARROW_FACTOR)),
    power: Math.min(length(pull), SHOT.maxPull) / SHOT.maxPull,
  };
};
