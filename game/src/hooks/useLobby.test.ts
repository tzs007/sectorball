import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../services/apiClient';
import { useLobby } from './useLobby';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLobby', () => {
  it('clears the polling error after a successful refresh', async () => {
    const listMatches = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    const api = { listMatches } as unknown as ApiClient;
    const { result } = renderHook(() => useLobby('t', api));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe('networkError');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.error).toBeNull();
  });
});
