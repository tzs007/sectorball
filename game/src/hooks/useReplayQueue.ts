import type { MatchView, Replay } from '@sectorball/shared';
import { useCallback, useState } from 'react';

export type ReplayItem = { readonly replay: Replay; readonly view: MatchView };

export type ReplayQueue = {
  readonly current: ReplayItem | null;
  push(item: ReplayItem): void;
  finishCurrent(): void;
};

/** FIFO of shot replays: replays arriving while one plays wait their turn. */
export const useReplayQueue = (): ReplayQueue => {
  const [queue, setQueue] = useState<readonly ReplayItem[]>([]);

  const push = useCallback((item: ReplayItem) => {
    setQueue((q) => [...q, item]);
  }, []);

  const finishCurrent = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  return { current: queue[0] ?? null, push, finishCurrent };
};
