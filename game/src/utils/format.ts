import { deadlines, TIMING } from '@sectorball/shared';
import type { GameState } from '@sectorball/shared';

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max));

/** `mm:ss`; fractions of a second are dropped, negatives show `00:00`. */
export const formatClock = (ms: number): string => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

/** `now` must already be corrected for client/server clock skew. */
export const halfRemainingMs = (state: GameState, now: number): number =>
  clamp(deadlines(state).halfEndsAt - now, 0, TIMING.halfLengthMs);

/** `now` must already be corrected for client/server clock skew. */
export const turnRemainingMs = (state: GameState, now: number): number => {
  const limit = state.phase === 'keeperSetup' ? TIMING.keeperSetupLimitMs : TIMING.turnLimitMs;
  return clamp(deadlines(state).turnEndsAt - now, 0, limit);
};
