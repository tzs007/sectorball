import { randomUUID } from 'node:crypto';
import {
  advanceClock,
  confirmKeeper,
  createGame,
  declareShot,
  moveKeeper,
  shoot,
  teamOf,
} from '@sectorball/shared';
import type {
  GameState,
  MatchStatus,
  MatchSummary,
  MatchView,
  PieceId,
  PlayerInfo,
  Replay,
  Result,
  Team,
  Vec,
} from '@sectorball/shared';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import type { MatchRepository } from '../models/match.ts';

export type MatchService = {
  listOpen(): MatchSummary[];
  create(player: PlayerInfo): Promise<MatchView>;
  join(matchId: string, player: PlayerInfo): Promise<MatchView>;
  get(matchId: string): MatchView;
  teamOf(matchId: string, playerId: string): Team | null;
  setConnected(matchId: string, team: Team, connected: boolean): MatchView;
  shoot(
    matchId: string,
    playerId: string,
    input: { seq: number; pieceId: PieceId; pull: Vec },
  ): Promise<{ view: MatchView; replay: Replay }>;
  declareShot(matchId: string, playerId: string, seq: number): Promise<MatchView>;
  confirmKeeper(matchId: string, playerId: string, seq: number): Promise<MatchView>;
  moveKeeper(matchId: string, playerId: string, y: number): MatchView;
  /** Applies due clock transitions; returns the views of the matches that changed. */
  tick(): Promise<MatchView[]>;
};

/** The authoritative in-memory record of a match. */
type LiveMatch = {
  readonly id: string;
  status: MatchStatus;
  readonly home: PlayerInfo;
  away: PlayerInfo | null;
  readonly createdAt: string;
  state: GameState | null;
  connected: Record<Team, boolean>;
};

const summaryOf = (m: LiveMatch): MatchSummary => ({
  id: m.id,
  status: m.status,
  home: m.home,
  away: m.away,
  createdAt: m.createdAt,
});

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
};

export const createMatchService = (deps: {
  matches: MatchRepository;
  now: () => number;
  random: () => number;
}): MatchService => {
  const { matches, now, random } = deps;
  /** Insertion order = creation order. */
  const live = new Map<string, LiveMatch>();

  const viewOf = (m: LiveMatch): MatchView => ({
    ...summaryOf(m),
    state: m.state,
    connected: { ...m.connected },
    serverNow: now(),
  });

  const find = (matchId: string): LiveMatch => {
    const m = live.get(matchId);
    if (!m) throw new NotFoundError('matchNotFound');
    return m;
  };

  /** Checks the actor may act on the live game; `seq` (when given) must match the current state. */
  const actor = (matchId: string, playerId: string, seq?: number): { m: LiveMatch; team: Team; state: GameState } => {
    const m = find(matchId);
    const team = teamOf(m, playerId);
    if (!team) throw new ConflictError('notParticipant');
    if (m.status !== 'live' || !m.state) throw new ConflictError('matchNotLive');
    if (seq !== undefined && seq !== m.state.seq) throw new ValidationError('staleState');
    return { m, team, state: m.state };
  };

  /** Stores a new state; persists the result once when it ends the match. */
  const commit = async (m: LiveMatch, state: GameState): Promise<MatchView> => {
    m.state = state;
    if (state.phase === 'finished' && m.status === 'live') {
      m.status = 'finished';
      await matches.finish(m.id, { ...state.score }, new Date(now()).toISOString());
    }
    return viewOf(m);
  };

  return {
    listOpen() {
      return [...live.values()]
        .filter((m) => m.status === 'open')
        .reverse()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(summaryOf);
    },

    async create(home) {
      const m: LiveMatch = {
        id: randomUUID(),
        status: 'open',
        home,
        away: null,
        createdAt: new Date(now()).toISOString(),
        state: null,
        connected: { home: false, away: false },
      };
      await matches.create({
        id: m.id,
        homePlayerId: home.id,
        awayPlayerId: null,
        homeScore: 0,
        awayScore: 0,
        status: m.status,
        createdAt: m.createdAt,
        finishedAt: null,
      });
      live.set(m.id, m);
      return viewOf(m);
    },

    async join(matchId, player) {
      const m = find(matchId);
      if (m.home.id === player.id) throw new ConflictError('ownMatch');
      if (m.status !== 'open') throw new ConflictError('matchFull');
      // claim the seat before awaiting so a concurrent join sees the match full
      m.away = player;
      m.status = 'live';
      m.state = createGame({ matchId, firstKickoff: random() < 0.5 ? 'home' : 'away', now: now() });
      await matches.markLive(matchId, player.id);
      return viewOf(m);
    },

    get(matchId) {
      return viewOf(find(matchId));
    },

    teamOf(matchId, playerId) {
      return teamOf(find(matchId), playerId);
    },

    setConnected(matchId, team, connected) {
      const m = find(matchId);
      m.connected = { ...m.connected, [team]: connected };
      return viewOf(m);
    },

    async shoot(matchId, playerId, input) {
      const { m, team, state } = actor(matchId, playerId, input.seq);
      const result = unwrap(shoot(state, team, input.pieceId, input.pull, now()));
      return { view: await commit(m, result.state), replay: result.replay };
    },

    async declareShot(matchId, playerId, seq) {
      const { m, team, state } = actor(matchId, playerId, seq);
      return commit(m, unwrap(declareShot(state, team, now())));
    },

    async confirmKeeper(matchId, playerId, seq) {
      const { m, team, state } = actor(matchId, playerId, seq);
      return commit(m, unwrap(confirmKeeper(state, team, now())));
    },

    moveKeeper(matchId, playerId, y) {
      const { m, team, state } = actor(matchId, playerId);
      // only moves the keeper: never finishes the match, so nothing to persist
      m.state = unwrap(moveKeeper(state, team, y, now()));
      return viewOf(m);
    },

    async tick() {
      const views: MatchView[] = [];
      for (const m of live.values()) {
        if (m.status !== 'live' || !m.state) continue;
        const next = advanceClock(m.state, now());
        if (next !== m.state) views.push(await commit(m, next));
      }
      return views;
    },
  };
};
