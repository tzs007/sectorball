import type { Vec } from "./geometry.ts";
import type { GameState, PieceId, Replay, Team } from "./types.ts";

export type PlayerInfo = { readonly id: string; readonly nickname: string };

export type MatchStatus = "open" | "live" | "finished" | "abandoned";

export type MatchSummary = {
  readonly id: string;
  readonly status: MatchStatus;
  readonly home: PlayerInfo;
  readonly away: PlayerInfo | null;
  readonly createdAt: string;
};

export type MatchView = MatchSummary & {
  readonly state: GameState | null;
  readonly connected: Readonly<Record<Team, boolean>>;
};

export type AckResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

export type Ack<T> = (res: AckResult<T>) => void;

export interface ClientToServerEvents {
  "match:watch": (matchId: string, ack: Ack<MatchView>) => void;
  "game:shoot": (
    p: { matchId: string; seq: number; pieceId: PieceId; pull: Vec },
    ack: Ack<null>,
  ) => void;
  "game:declareShot": (p: { matchId: string; seq: number }, ack: Ack<null>) => void;
  "game:moveKeeper": (p: { matchId: string; y: number }) => void;
  "game:confirmKeeper": (p: { matchId: string; seq: number }, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  "match:updated": (view: MatchView) => void;
  "game:shot": (p: { matchId: string; replay: Replay; view: MatchView }) => void;
}

export const teamOf = (view: MatchSummary, playerId: string): Team | null => {
  if (view.home.id === playerId) return "home";
  if (view.away?.id === playerId) return "away";
  return null;
};
