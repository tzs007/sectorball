import { describe, expect, it } from 'vitest';
import type { Frame, Replay } from '@sectorball/shared';
import { frameIndexAt, isReplayDone } from './replay';

const frameMs = 1000 / 60;
const replay: Replay = { frames: Array.from({ length: 10 }, (): Frame => ({})), frameMs };

describe('replay sampling', () => {
  it('maps elapsed time to a clamped frame index', () => {
    expect(frameIndexAt(replay, 0)).toBe(0);
    expect(frameIndexAt(replay, 50)).toBe(3);
    expect(frameIndexAt(replay, 10_000)).toBe(9);
    expect(frameIndexAt(replay, -5)).toBe(0);
  });

  it('is done once all frames have been shown', () => {
    expect(isReplayDone(replay, 10 * frameMs - 1)).toBe(false);
    expect(isReplayDone(replay, 10 * frameMs)).toBe(true);
    expect(isReplayDone(replay, 10_000)).toBe(true);
  });
});
