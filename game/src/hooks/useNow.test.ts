import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current time and ticks on the interval', () => {
    const { result } = renderHook(() => useNow(250));
    expect(result.current).toBe(1000);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(1500);
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
