import { useCallback, useEffect, useState } from 'react';

const PREFIX = '#/match/';

const readMatchId = (): string | null => {
  const { hash } = window.location;
  if (!hash.startsWith(PREFIX) || hash.length === PREFIX.length) return null;
  return decodeURIComponent(hash.slice(PREFIX.length));
};

/** The current match id, kept in the URL hash (`#/match/<id>`) so a reload returns to the match. */
export const useMatchRoute = () => {
  const [matchId, setMatchId] = useState(readMatchId);

  useEffect(() => {
    const onHashChange = () => {
      setMatchId(readMatchId());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const enter = useCallback((id: string) => {
    window.location.hash = `/match/${encodeURIComponent(id)}`;
    setMatchId(id);
  }, []);

  const leave = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setMatchId(null);
  }, []);

  return { matchId, enter, leave };
};
