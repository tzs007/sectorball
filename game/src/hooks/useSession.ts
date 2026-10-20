import { useCallback, useEffect, useState } from 'react';
import type { PlayerInfo } from '@sectorball/shared';
import { ApiError, createApiClient, errorCode } from '../services/apiClient';
import type { ApiClient } from '../services/apiClient';

export type Session = { readonly token: string; readonly player: PlayerInfo };

const STORAGE_KEY = 'sectorball.session';

const isSession = (value: unknown): value is Session => {
  if (typeof value !== 'object' || value === null) return false;
  const { token, player } = value as Record<string, unknown>;
  if (typeof token !== 'string' || typeof player !== 'object' || player === null) return false;
  const { id, nickname } = player as Record<string, unknown>;
  return typeof id === 'string' && typeof nickname === 'string';
};

const loadSession = (): Session | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSession(parsed)) return parsed;
  } catch {
    // malformed JSON is treated like a wrong shape
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
};

const defaultApi = createApiClient();

export const useSession = (api: ApiClient = defaultApi) => {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [status, setStatus] = useState<'checking' | 'ready'>(session === null ? 'ready' : 'checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (stored === null) return;
    let cancelled = false;
    api
      .me(stored.token)
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
        } else {
          setError(errorCode(err));
        }
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const login = useCallback(
    async (nickname: string) => {
      setError(null);
      try {
        const created = await api.createSession(nickname);
        const next: Session = { token: created.token, player: created.player };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      } catch (err) {
        setError(errorCode(err));
      }
    },
    [api],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return { session, status, login, logout, error };
};
