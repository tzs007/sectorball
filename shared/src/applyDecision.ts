import { CENTER } from "./constants.ts";
import { defendedSide, formation } from "./field.ts";
import type { Vec } from "./geometry.ts";
import { vec } from "./geometry.ts";
import type { SimResult } from "./physics.ts";
import {
  cornerPoint,
  goalKickPoint,
  placeFreeKick,
  placePenalty,
} from "./restarts.ts";
import type { Layout } from "./restarts.ts";
import { other } from "./types.ts";
import type { Decision, GameState, Piece, Team } from "./types.ts";

type Half = GameState["half"];

export const centerSpot = (): Vec => vec(CENTER.x, CENTER.y);

/** Both teams in their formations for `half`, `kickoffTeam` with a button at the centre circle. */
export const kickoffPieces = (half: Half, kickoffTeam: Team): Piece[] => [
  ...formation("home", half, kickoffTeam === "home"),
  ...formation("away", half, kickoffTeam === "away"),
];

/** Kickoff for `team`: fresh formations, ball on the centre spot. */
const kickoff = (state: GameState, team: Team): Partial<GameState> => ({
  pieces: kickoffPieces(state.half, team),
  ball: centerSpot(),
  turn: team,
  restart: { kind: "kickoff" },
});

type PlacedRestart = "freeKick" | "throwIn" | "corner" | "goalKick";

const restartAt = (
  layout: Layout,
  awardedTo: Team,
  kind: PlacedRestart,
): Partial<GameState> => ({
  ...layout,
  turn: awardedTo,
  restart: { kind },
});

/** Where the ball is put for an out-of-play restart. */
const outPoint = (
  state: GameState,
  decision: Extract<Decision, { kind: "out" }>,
): Vec => {
  switch (decision.restart) {
    case "throwIn":
      return decision.at;
    case "corner":
      // The ball left over the goal line of the team that conceded the corner.
      return cornerPoint(
        defendedSide(other(decision.awardedTo), state.half),
        decision.at.y,
      );
    case "goalKick":
      return goalKickPoint(defendedSide(decision.awardedTo, state.half));
  }
};

/** Position, turn and restart changes a shot decision makes (on top of the shared bookkeeping). */
const outcome = (
  state: GameState,
  shooter: Team,
  decision: Decision,
  sim: SimResult,
): Partial<GameState> => {
  switch (decision.kind) {
    case "goal":
      return {
        ...kickoff(state, other(decision.scorer)),
        score: {
          ...state.score,
          [decision.scorer]: state.score[decision.scorer] + 1,
        },
      };
    case "goalDisallowed": {
      const at = goalKickPoint(defendedSide(decision.awardedTo, state.half));
      return restartAt(
        placeFreeKick(sim.pieces, at, decision.awardedTo),
        decision.awardedTo,
        "goalKick",
      );
    }
    case "out": {
      const layout = placeFreeKick(
        sim.pieces,
        outPoint(state, decision),
        decision.awardedTo,
      );
      return restartAt(layout, decision.awardedTo, decision.restart);
    }
    case "foul": {
      if (!decision.penalty) {
        return restartAt(
          placeFreeKick(sim.pieces, decision.at, decision.awardedTo),
          decision.awardedTo,
          "freeKick",
        );
      }
      const foulingTeam = other(decision.awardedTo);
      const { pieces, ball, kickerId } = placePenalty(
        sim.pieces,
        foulingTeam,
        state.half,
        decision.awardedTo,
      );
      return {
        pieces,
        ball,
        phase: "keeperSetup",
        turn: foulingTeam,
        shotDeclared: true,
        restart: { kind: "penalty", kickerId },
      };
    }
    case "kickoffRetake":
      return kickoff(state, state.turn);
    default: // 'play' (judgeShot never returns the clock decisions)
      return {
        pieces: sim.pieces,
        ball: sim.ball,
        turn: other(shooter),
        restart: null,
      };
  }
};

/** Next state after a simulated shot by `shooter` and the referee's `decision`. */
export const applyDecision = (
  state: GameState,
  shooter: Team,
  decision: Decision,
  sim: SimResult,
  now: number,
): GameState => ({
  ...state,
  shotDeclared: false,
  ...outcome(state, shooter, decision, sim),
  lastDecision: decision,
  turnStartedAt: now,
  seq: state.seq + 1,
});
