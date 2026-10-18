import type { AckResult, MatchView, PieceId, ServerToClientEvents, Vec } from '@sectorball/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectGameSocket } from '../services/gameSocket';
import type { GameSocket } from '../services/gameSocket';
import { useReplayQueue } from './useReplayQueue';
import type { ReplayItem } from './useReplayQueue';

export type MatchConnection = 'connecting' | 'ready' | 'gone';

export type UseMatch = {
  /** The view to display; during a replay this is still the state before the shot. */
  readonly view: MatchView | null;
  readonly status: MatchConnection;
  /** Server clock minus client clock (ms), measured on the latest received view. */
  readonly serverClockOffsetMs: number;
  /** The replay to play now; its `view` becomes the displayed view after `finishReplay`. */
  readonly replayItem: ReplayItem | null;
  readonly shoot: (pieceId: PieceId, pull: Vec) => void;
  readonly declareShot: () => void;
  readonly moveKeeper: (y: number) => void;
  readonly confirmKeeper: () => void;
  readonly finishReplay: () => void;
  readonly error: string | null;
};

type ShotEvent = Parameters<ServerToClientEvents['game:shot']>[0];

/** Watches one match over Socket.IO and exposes its view, shot replays and the player's actions. */
export const useMatch = (
  token: string,
  matchId: string,
  socketFactory: (token: string) => GameSocket = connectGameSocket,
): UseMatch => {
  const { current: replayItem, push, finishCurrent } = useReplayQueue();
  const [view, setView] = useState<MatchView | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  /** Replays pushed but not finished yet (read synchronously by the socket handlers). */
  const queuedRef = useRef(0);
  /** Latest `match:updated` received during a replay, applied once the queue drained. */
  const pendingRef = useRef<MatchView | null>(null);
  const finishedRef = useRef<ReplayItem | null>(null);

  useEffect(() => {
    const socket = socketFactory(token);
    socketRef.current = socket;
    queuedRef.current = 0;
    pendingRef.current = null;

    const accept = (next: MatchView): boolean => {
      if (next.id !== matchId) return false;
      setServerClockOffsetMs(next.serverNow - Date.now());
      return true;
    };
    const onUpdated = (next: MatchView) => {
      if (!accept(next)) return;
      if (queuedRef.current > 0) pendingRef.current = next;
      else setView(next);
    };
    const onShot = ({ replay, view: next }: ShotEvent) => {
      if (!accept(next)) return;
      // the shot's view supersedes any update received before it
      pendingRef.current = null;
      queuedRef.current += 1;
      push({ replay, view: next });
    };
    // the server does not re-join rooms after a reconnect, so watch on every connect
    const onConnect = () => {
      socket.emit('match:watch', matchId, (res: AckResult<MatchView>) => {
        if (res.ok) onUpdated(res.data);
        else if (res.error === 'matchNotFound') setNotFound(true);
        else setError(res.error);
      });
    };

    socket.on('connect', onConnect);
    socket.on('match:updated', onUpdated);
    socket.on('game:shot', onShot);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('match:updated', onUpdated);
      socket.off('game:shot', onShot);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, matchId, socketFactory, push]);

  const finishReplay = useCallback(() => {
    if (replayItem === null || finishedRef.current === replayItem) return;
    finishedRef.current = replayItem;
    finishCurrent();
    queuedRef.current -= 1;
    const pending = queuedRef.current === 0 ? pendingRef.current : null;
    if (pending !== null) pendingRef.current = null;
    setView(pending ?? replayItem.view);
  }, [replayItem, finishCurrent]);

  const onAck = useCallback((res: AckResult<null>) => {
    // staleState: the server pushes the current view with the next update
    if (!res.ok && res.error !== 'staleState') setError(res.error);
  }, []);

  const seq = view?.state?.seq;

  const shoot = useCallback(
    (pieceId: PieceId, pull: Vec) => {
      if (seq === undefined) return;
      setError(null);
      socketRef.current?.emit('game:shoot', { matchId, seq, pieceId, pull }, onAck);
    },
    [matchId, seq, onAck],
  );

  const declareShot = useCallback(() => {
    if (seq === undefined) return;
    setError(null);
    socketRef.current?.emit('game:declareShot', { matchId, seq }, onAck);
  }, [matchId, seq, onAck]);

  const confirmKeeper = useCallback(() => {
    if (seq === undefined) return;
    setError(null);
    socketRef.current?.emit('game:confirmKeeper', { matchId, seq }, onAck);
  }, [matchId, seq, onAck]);

  const moveKeeper = useCallback(
    (y: number) => {
      socketRef.current?.emit('game:moveKeeper', { matchId, y });
    },
    [matchId],
  );

  const gone = notFound || view?.status === 'abandoned';
  const status: MatchConnection = gone ? 'gone' : view === null ? 'connecting' : 'ready';

  return {
    view,
    status,
    serverClockOffsetMs,
    replayItem,
    shoot,
    declareShot,
    moveKeeper,
    confirmKeeper,
    finishReplay,
    error,
  };
};
