import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientText } from './useTransientText';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTransientText', () => {
  it('shows the text and hides it after 3 s', () => {
    const { result } = renderHook(() => useTransientText('GÓL!', 1));
    expect(result.current).toBe('GÓL!');
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current).toBe('GÓL!');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBeNull();
  });

  it('restarts the countdown and shows again when the key changes', () => {
    const { result, rerender } = renderHook(({ text, key }) => useTransientText(text, key), {
      initialProps: { text: 'GÓL!', key: 1 },
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBeNull();

    rerender({ text: 'Szöglet', key: 2 });
    expect(result.current).toBe('Szöglet');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ text: 'Kirúgás', key: 3 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe('Kirúgás');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeNull();
  });

  it('clears its timer on unmount', () => {
    const { unmount } = renderHook(() => useTransientText('GÓL!', 1));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
