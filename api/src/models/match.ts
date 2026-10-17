import type { MatchStatus, Team } from '@sectorball/shared';

export type MatchRecord = {
  readonly id: string;
  readonly homePlayerId: string;
  readonly awayPlayerId: string | null;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly status: MatchStatus;
  readonly createdAt: string;
  readonly finishedAt: string | null;
};

export interface MatchRepository {
  create(m: MatchRecord): Promise<void>;
  markLive(id: string, awayPlayerId: string): Promise<void>;
  finish(id: string, score: Record<Team, number>, finishedAt: string): Promise<void>;
  /** Marks every `open` or `live` match `abandoned` (on startup); returns how many changed. */
  abandonUnfinished(): Promise<number>;
}
