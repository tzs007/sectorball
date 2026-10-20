import type { MatchSummary, MatchView } from '@sectorball/shared';
import { useCallback, useEffect, useState } from 'react';
import { errorCode } from '../services/apiClient';
import type { ApiClient } from '../services/apiClient';

const REFRESH_MS = 3000;

/** Open matches (refreshed on mount and every 3 s) plus create/join; failures reject and set `error`. */
export const useLobby = (token: string, api: ApiClient) => {
  const [matches, setMatches] = useState<readonly MatchSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      api.listMatches(token).then(
        (items) => {
          if (cancelled) return;
          setMatches(items);
          setError(null);
        },
        (err: unknown) => {
          if (!cancelled) setError(errorCode(err));
        },
      );
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, api]);

  const run = useCallback(async (action: () => Promise<MatchView>): Promise<MatchView> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(errorCode(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(() => run(() => api.createMatch(token)), [run, api, token]);
  const join = useCallback((id: string) => run(() => api.joinMatch(token, id)), [run, api, token]);

  return { matches, create, join, busy, error };
};
