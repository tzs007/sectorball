import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import type { ApiClient } from '../services/apiClient';
import { useSession } from './useSession';

const KEY = 'sectorball.session';
const player = { id: 'p1', nickname: 'Zsolt' };

const fakeApi = (overrides: Partial<ApiClient> = {}): ApiClient =>
  ({
    createSession: vi.fn().mockResolvedValue({ token: 't1', player }),
    me: vi.fn().mockResolvedValue(player),
    ...overrides,
  }) as unknown as ApiClient;

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is ready without a session when nothing is stored', () => {
    const { result } = renderHook(() => useSession(fakeApi()));
    expect(result.current.status).toBe('ready');
    expect(result.current.session).toBeNull();
  });

  it('login stores the session', async () => {
    const { result } = renderHook(() => useSession(fakeApi()));
    await act(() => result.current.login('Zsolt'));
    expect(result.current.session).toEqual({ token: 't1', player });
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ token: 't1', player });
  });

  it('login failure exposes the error code', async () => {
    const api = fakeApi({ createSession: vi.fn().mockRejectedValue(new ApiError(400, 'invalidNickname')) });
    const { result } = renderHook(() => useSession(api));
    await act(() => result.current.login('x'));
    expect(result.current.error).toBe('invalidNickname');
    expect(result.current.session).toBeNull();
  });

  it('restores a valid stored session', async () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't1', player }));
    const { result } = renderHook(() => useSession(fakeApi()));
    expect(result.current.status).toBe('checking');
    await waitFor(() => { expect(result.current.status).toBe('ready'); });
    expect(result.current.session).toEqual({ token: 't1', player });
  });

  it('clears an invalid stored session', async () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'bad', player }));
    const api = fakeApi({ me: vi.fn().mockRejectedValue(new ApiError(401, 'unauthorized')) });
    const { result } = renderHook(() => useSession(api));
    await waitFor(() => { expect(result.current.status).toBe('ready'); });
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clears a malformed stored value', () => {
    localStorage.setItem(KEY, '{nope');
    const { result } = renderHook(() => useSession(fakeApi()));
    expect(result.current.session).toBeNull();
    expect(result.current.status).toBe('ready');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the stored session on a network error', async () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't1', player }));
    const api = fakeApi({ me: vi.fn().mockRejectedValue(new TypeError('network')) });
    const { result } = renderHook(() => useSession(api));
    await waitFor(() => { expect(result.current.status).toBe('ready'); });
    expect(result.current.session).toEqual({ token: 't1', player });
    expect(result.current.error).not.toBeNull();
  });

  it('logout clears storage and state', async () => {
    const { result } = renderHook(() => useSession(fakeApi()));
    await act(() => result.current.login('Zsolt'));
    act(() => { result.current.logout(); });
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
