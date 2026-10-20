import { act, renderHook } from '@testing-library/react';
import type { Replay } from '@sectorball/shared';
import type { Ticker } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_PLAYBACK, stepPlayback, useReplayPlayback } from './useReplayPlayback';

let tickCallback: ((ticker: Ticker) => void) | null = null;
vi.mock('@pixi/react', () => ({
  useTick: (opts: { callback: (ticker: Ticker) => void }) => {
    tickCallback = opts.callback;
  },
}));

const replayOf = (frames: number, frameMs = 10): Replay => ({
  frames: Array.from({ length: frames }, (_, i) => ({ ball: [i, 0] as const })),
  frameMs,
});

/** Fake ticker: runs the currently registered tick callback with the given delta. */
const tick = (deltaMS: number) => {
  act(() => {
    tickCallback?.({ deltaMS } as Ticker);
  });
};

describe('stepPlayback', () => {
  it('advances the frame index and reports the end exactly once', () => {
    const replay = replayOf(3);
    let s = stepPlayback(IDLE_PLAYBACK, replay, 15);
    expect(s).toMatchObject({ index: 1, ended: false });
    s = stepPlayback(s.state, replay, 15);
    expect(s).toMatchObject({ index: 2, ended: true });
    s = stepPlayback(s.state, replay, 15);
    expect(s).toMatchObject({ index: 2, ended: false });
  });

  it('restarts from zero when a different replay arrives mid-playback', () => {
    const a = replayOf(10);
    const b = replayOf(3);
    const mid = stepPlayback(IDLE_PLAYBACK, a, 50).state;
    const s = stepPlayback(mid, b, 5);
    expect(s).toMatchObject({ index: 0, ended: false });
    expect(s.state.elapsedMs).toBe(5);
  });

  it('ends an empty replay on the first step, once', () => {
    const replay = replayOf(0);
    const first = stepPlayback(IDLE_PLAYBACK, replay, 16);
    expect(first.ended).toBe(true);
    expect(stepPlayback(first.state, replay, 16).ended).toBe(false);
  });
});

describe('useReplayPlayback', () => {
  beforeEach(() => {
    tickCallback = null;
  });

  it('fires onEnd exactly once for B when switching from A mid-playback', () => {
    const onEnd = vi.fn();
    const a = replayOf(10);
    const b = replayOf(3);
    const { rerender } = renderHook(({ replay }) => useReplayPlayback(replay, onEnd), {
      initialProps: { replay: a },
    });
    tick(95);
    rerender({ replay: b });
    tick(10);
    expect(onEnd).not.toHaveBeenCalled();
    tick(25);
    tick(25);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('fires once for a one-frame replay and never after done', () => {
    const onEnd = vi.fn();
    const replay = replayOf(1);
    renderHook(() => useReplayPlayback(replay, onEnd));
    tick(16);
    tick(16);
    tick(16);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('returns the current frame index', () => {
    const replay = replayOf(5);
    const onEnd = vi.fn();
    const { result } = renderHook(() => useReplayPlayback(replay, onEnd));
    expect(result.current).toBe(0);
    tick(25);
    expect(result.current).toBe(2);
  });
});
