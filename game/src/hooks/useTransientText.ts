import { useEffect, useState } from 'react';

const VISIBLE_MS = 3000;

/** `text` for 3 s after every change of `key`, then null. */
export const useTransientText = (text: string | null, key: number): string | null => {
  const [expiredKey, setExpiredKey] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setExpiredKey(key);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(id);
    };
  }, [key]);

  return expiredKey === key ? null : text;
};
