import { useTick } from '@pixi/react';
import type { Replay } from '@sectorball/shared';
import type { Ticker } from 'pixi.js';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { frameIndexAt, isReplayDone } from '../utils/replay';

export type PlaybackState = { readonly replay: Replay | null; readonly elapsedMs: number; readonly done: boolean };

export const IDLE_PLAYBACK: PlaybackState = { replay: null, elapsedMs: 0, done: false };

/**
 * One ticker step. A replay different from the one in `s` restarts from zero, so a replay switch is detected in
 * the tick itself (no effect ordering involved). `ended` is true only on the step that finishes the replay.
 */
export const stepPlayback = (
  s: PlaybackState,
  replay: Replay | null,
  deltaMs: number,
): { state: PlaybackState; index: number; ended: boolean } => {
  if (replay === null) return { state: IDLE_PLAYBACK, index: 0, ended: false };
  const current = s.replay === replay ? s : { replay, elapsedMs: 0, done: false };
  if (current.done) return { state: current, index: frameIndexAt(replay, current.elapsedMs), ended: false };
  const elapsedMs = current.elapsedMs + deltaMs;
  const ended = isReplayDone(replay, elapsedMs);
  return { state: { replay, elapsedMs, done: ended }, index: frameIndexAt(replay, elapsedMs), ended };
};

/** Plays `replay` on the Pixi ticker; returns the frame index to show and calls `onEnd` once per replay. */
export const useReplayPlayback = (replay: Replay | null, onEnd: () => void): number => {
  const playbackRef = useRef<PlaybackState>(IDLE_PLAYBACK);
  const onEndRef = useRef(onEnd);
  useLayoutEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const [cursor, setCursor] = useState<{ replay: Replay | null; index: number }>({ replay: null, index: 0 });

  const tick = useCallback(
    (ticker: Ticker) => {
      const step = stepPlayback(playbackRef.current, replay, ticker.deltaMS);
      playbackRef.current = step.state;
      if (replay === null) return;
      const { index } = step;
      setCursor((c) => (c.replay === replay && c.index === index ? c : { replay, index }));
      if (step.ended) onEndRef.current();
    },
    [replay],
  );
  useTick({ callback: tick, isEnabled: replay !== null });

  return cursor.replay === replay ? cursor.index : 0;
};
