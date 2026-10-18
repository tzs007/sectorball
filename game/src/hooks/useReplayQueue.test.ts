import { act, renderHook } from '@testing-library/react';
import type { MatchView, Replay } from '@sectorball/shared';
import { describe, expect, it } from 'vitest';
import { useReplayQueue } from './useReplayQueue';

const item = (id: string) => ({
  replay: { frames: [], frameMs: 16 } satisfies Replay,
  view: { id } as unknown as MatchView,
});

describe('useReplayQueue', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useReplayQueue());
    expect(result.current.current).toBeNull();
  });

  it('queues replays that arrive during playback', () => {
    const a = item('a');
    const b = item('b');
    const { result } = renderHook(() => useReplayQueue());
    act(() => {
      result.current.push(a);
    });
    act(() => {
      result.current.push(b);
    });
    expect(result.current.current).toBe(a);
    act(() => {
      result.current.finishCurrent();
    });
    expect(result.current.current).toBe(b);
    act(() => {
      result.current.finishCurrent();
    });
    expect(result.current.current).toBeNull();
  });
});
