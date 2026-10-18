import type { Replay } from '@sectorball/shared';

export const frameIndexAt = (replay: Replay, elapsedMs: number): number => {
  const index = Math.floor(elapsedMs / replay.frameMs);
  return Math.max(0, Math.min(index, replay.frames.length - 1));
};

export const isReplayDone = (replay: Replay, elapsedMs: number): boolean =>
  elapsedMs >= replay.frames.length * replay.frameMs;
