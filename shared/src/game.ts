import { applyDecision, centerSpot, kickoffPieces } from "./applyDecision.ts";
import { SHOT, TIMING } from "./constants.ts";
import { clampKeeperY, isInAttackingHalf } from "./field.ts";
import type { Vec } from "./geometry.ts";
import { isFiniteVec, length, vec } from "./geometry.ts";
import { shotVelocity, simulate } from "./physics.ts";
import { judgeShot } from "./referee.ts";
import { other } from "./types.ts";
import type {
  GameError,
  GameState,
  Phase,
  PieceId,
  Replay,
  Result,
  Team,
} from "./types.ts";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: GameError): Result<T> => ({ ok: false, error });

const REPLAY_FRAME_MS = 1000 / 60;

export const createGame = (input: {
  matchId: string;
  firstKickoff: Team;
  now: number;
}): GameState => ({
  matchId: input.matchId,
  phase: "aiming",
  half: 1,
  turn: input.firstKickoff,
  firstKickoff: input.firstKickoff,
  score: { home: 0, away: 0 },
  pieces: kickoffPieces(1, input.firstKickoff),
  ball: centerSpot(),
  restart: { kind: "kickoff" },
  shotDeclared: false,
  halfStartedAt: input.now,
  turnStartedAt: input.now,
  lastDecision: null,
  winner: null,
  seq: 0,
});

const startShot = (state: GameState, now: number): GameState => ({
  ...state,
  phase: "aiming",
  turn: other(state.turn),
  shotDeclared: true,
  turnStartedAt: now,
  seq: state.seq + 1,
});

const winnerOf = (score: GameState["score"]): GameState["winner"] => {
  if (score.home === score.away) return "draw";
  return score.home > score.away ? "home" : "away";
};

const endHalf = (state: GameState, now: number): GameState => {
  if (state.half === 2) {
    return {
      ...state,
      phase: "finished",
      winner: winnerOf(state.score),
      lastDecision: { kind: "fullTime" },
      seq: state.seq + 1,
    };
  }
  const kickoffTeam = other(state.firstKickoff);
  return {
    ...state,
    phase: "aiming",
    half: 2,
    turn: kickoffTeam,
    pieces: kickoffPieces(2, kickoffTeam),
    ball: centerSpot(),
    restart: { kind: "kickoff" },
    shotDeclared: false,
    halfStartedAt: now,
    turnStartedAt: now,
    lastDecision: { kind: "halfTime" },
    seq: state.seq + 1,
  };
};

/** Applies clock-driven transitions; returns `state` itself when nothing is due. */
export const advanceClock = (state: GameState, now: number): GameState => {
  if (state.phase === "finished") return state;
  if (
    now - state.halfStartedAt >= TIMING.halfLengthMs &&
    state.restart?.kind !== "penalty"
  ) {
    return endHalf(state, now);
  }
  const turnAge = now - state.turnStartedAt;
  if (state.phase === "keeperSetup") {
    return turnAge >= TIMING.keeperSetupLimitMs ? startShot(state, now) : state;
  }
  if (turnAge < TIMING.turnLimitMs) return state;
  return {
    ...state,
    turn: other(state.turn),
    restart: null,
    shotDeclared: false,
    lastDecision: { kind: "turnTimeout", team: state.turn },
    turnStartedAt: now,
    seq: state.seq + 1,
  };
};

/** When the current half and the current turn (or keeper setup) run out. */
export const deadlines = (
  state: GameState,
): { halfEndsAt: number; turnEndsAt: number } => ({
  halfEndsAt: state.halfStartedAt + TIMING.halfLengthMs,
  turnEndsAt:
    state.turnStartedAt +
    (state.phase === "keeperSetup"
      ? TIMING.keeperSetupLimitMs
      : TIMING.turnLimitMs),
});

/** Error for acting as `team` unless the game is in `phase` and it is `team`'s turn. */
const actionError = (
  state: GameState,
  team: Team,
  phase: Phase,
): GameError | null => {
  if (state.phase === "finished") return "matchFinished";
  if (state.phase !== phase) return "wrongPhase";
  if (state.turn !== team) return "notYourTurn";
  return null;
};

/** `actionError` for an action at `now`; a clock transition already due at `now` makes the state stale. */
const actionErrorAt = (
  state: GameState,
  team: Team,
  phase: Phase,
  now: number,
): GameError | null =>
  advanceClock(state, now) === state
    ? actionError(state, team, phase)
    : "staleState";

export const canShoot = (
  state: GameState,
  team: Team,
  pieceId: PieceId,
): boolean => {
  if (actionError(state, team, "aiming")) return false;
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (piece?.kind !== "button" || piece.team !== team) return false;
  return (
    state.restart?.kind !== "penalty" || state.restart.kickerId === pieceId
  );
};

export const canDeclareShot = (state: GameState, team: Team): boolean =>
  !actionError(state, team, "aiming") &&
  !state.shotDeclared &&
  state.restart?.kind !== "penalty" &&
  isInAttackingHalf(state.ball, team, state.half);

export const shoot = (
  state: GameState,
  team: Team,
  pieceId: PieceId,
  pull: Vec,
  now: number,
): Result<{ state: GameState; replay: Replay }> => {
  const error = actionErrorAt(state, team, "aiming", now);
  if (error) return fail(error);
  const shooter = state.pieces.find((p) => p.id === pieceId);
  if (!shooter || !canShoot(state, team, pieceId)) return fail("invalidPiece");
  if (!isFiniteVec(pull) || length(pull) < SHOT.minPull)
    return fail("invalidPull");

  const sim = simulate(state.pieces, state.ball, pieceId, shotVelocity(pull));
  const decision = judgeShot(state, shooter, sim);
  // the next turn starts once the replay has played
  const replayMs = sim.frames.length * REPLAY_FRAME_MS;
  return ok({
    state: applyDecision(state, team, decision, sim, now + replayMs),
    replay: { frames: sim.frames, frameMs: REPLAY_FRAME_MS },
  });
};

export const declareShot = (
  state: GameState,
  team: Team,
  now: number,
): Result<GameState> => {
  const error = actionErrorAt(state, team, "aiming", now);
  if (error) return fail(error);
  if (!canDeclareShot(state, team)) return fail("shotNotAllowed");
  return ok({
    ...state,
    phase: "keeperSetup",
    turn: other(team),
    turnStartedAt: now,
    seq: state.seq + 1,
  });
};

export const moveKeeper = (
  state: GameState,
  team: Team,
  y: number,
  now: number,
): Result<GameState> => {
  const error = actionErrorAt(state, team, "keeperSetup", now);
  if (error) return fail(error);
  if (!Number.isFinite(y)) return fail("invalidKeeperPosition");
  const keeperId: PieceId = `${team}-gk`;
  const pieces = state.pieces.map((p) =>
    p.id === keeperId ? { ...p, pos: vec(p.pos.x, clampKeeperY(y)) } : p,
  );
  return ok({ ...state, pieces });
};

export const confirmKeeper = (
  state: GameState,
  team: Team,
  now: number,
): Result<GameState> => {
  const error = actionErrorAt(state, team, "keeperSetup", now);
  return error ? fail(error) : ok(startShot(state, now));
};
