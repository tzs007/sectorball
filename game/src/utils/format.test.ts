import { describe, expect, it } from 'vitest';
import { TIMING } from '@sectorball/shared';
import type { GameState } from '@sectorball/shared';
import { formatClock, halfRemainingMs, turnRemainingMs } from './format';

const state = (over: Partial<GameState>): GameState =>
  ({ phase: 'aiming', halfStartedAt: 0, turnStartedAt: 0, ...over }) as GameState;

describe('formatClock', () => {
  it('formats mm:ss', () => {
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(61_500)).toBe('01:01');
    expect(formatClock(0)).toBe('00:00');
  });
  it('clamps negatives to zero', () => {
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('halfRemainingMs', () => {
  it('counts down to the half end', () => {
    expect(halfRemainingMs(state({ halfStartedAt: 1000 }), 61_000)).toBe(540_000);
  });
  it('clamps to [0, half length]', () => {
    expect(halfRemainingMs(state({ halfStartedAt: 1000 }), 0)).toBe(TIMING.halfLengthMs);
    expect(halfRemainingMs(state({}), 700_000)).toBe(0);
  });
});

describe('turnRemainingMs', () => {
  it('counts down the turn limit', () => {
    expect(turnRemainingMs(state({ turnStartedAt: 1000 }), 11_000)).toBe(20_000);
  });
  it('uses the keeper setup limit in keeper setup', () => {
    expect(turnRemainingMs(state({ phase: 'keeperSetup', turnStartedAt: 0 }), 5_000)).toBe(10_000);
  });
  it('shows the full limit while a replay pushes the deadline far away', () => {
    expect(turnRemainingMs(state({ turnStartedAt: 10_000 }), 0)).toBe(TIMING.turnLimitMs);
    expect(turnRemainingMs(state({ phase: 'keeperSetup', turnStartedAt: 20_000 }), 0)).toBe(
      TIMING.keeperSetupLimitMs,
    );
  });
  it('never goes negative', () => {
    expect(turnRemainingMs(state({}), 99_000)).toBe(0);
  });
});
