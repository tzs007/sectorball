import { useEffect, useState } from 'react';

/** Current `Date.now()`, refreshed every `intervalMs`. */
export const useNow = (intervalMs = 250): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
};
