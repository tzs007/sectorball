import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMatchRoute } from './useMatchRoute';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useMatchRoute', () => {
  it('reads the match id from the hash on startup', () => {
    window.history.replaceState(null, '', '/#/match/m1');
    const { result } = renderHook(() => useMatchRoute());
    expect(result.current.matchId).toBe('m1');
  });

  it('has no match without a match hash', () => {
    const { result } = renderHook(() => useMatchRoute());
    expect(result.current.matchId).toBeNull();
  });

  it('writes the hash on enter and clears it on leave', () => {
    const { result } = renderHook(() => useMatchRoute());
    act(() => {
      result.current.enter('m2');
    });
    expect(result.current.matchId).toBe('m2');
    expect(window.location.hash).toBe('#/match/m2');
    act(() => {
      result.current.leave();
    });
    expect(result.current.matchId).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
