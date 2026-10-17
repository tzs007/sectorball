import { describe, expect, it } from "vitest";
import { formation } from "./field.ts";
import {
  advanceClock,
  canDeclareShot,
  canShoot,
  confirmKeeper,
  createGame,
  declareShot,
  moveKeeper,
  shoot,
} from "./game.ts";
import type { Vec } from "./geometry.ts";
import { vec } from "./geometry.ts";
import { placePenalty } from "./restarts.ts";
import type { GameState, Piece, PieceId, Result } from "./types.ts";

const piece = (id: PieceId, x: number, y: number): Piece => ({
  id,
  team: id.startsWith("home") ? "home" : "away",
  kind: id.endsWith("gk") ? "keeper" : "button",
  pos: vec(x, y),
});

const game = (overrides: Partial<GameState> = {}): GameState => ({
  ...createGame({ matchId: "m", firstKickoff: "home", now: 0 }),
  ...overrides,
});

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.value;
};

const errorOf = <T>(result: Result<T>): string | null =>
  result.ok ? null : result.error;

const posOf = (state: GameState, id: PieceId): Vec | undefined =>
  state.pieces.find((p) => p.id === id)?.pos;

const MIN_PULL = vec(0, 10);

/** Ball in the away half (home attacks right in half 1), open play. */
const attackingState = (): GameState =>
  game({ restart: null, ball: vec(700, 320) });

/** Penalty for home at the right spot, waiting for the away keeper setup. */
const penaltyState = (overrides: Partial<GameState> = {}): GameState => {
  const layout = placePenalty(
    [...formation("home", 1, false), ...formation("away", 1, false)],
    "away",
    1,
    "home",
  );
  return game({
    pieces: layout.pieces,
    ball: layout.ball,
    phase: "keeperSetup",
    turn: "away",
    shotDeclared: true,
    restart: { kind: "penalty", kickerId: layout.kickerId },
    ...overrides,
  });
};

describe("createGame", () => {
  it("starts half 1 with kickoff formations for the first kickoff team", () => {
    const state = createGame({ matchId: "m1", firstKickoff: "away", now: 123 });
    expect(state.pieces).toHaveLength(12);
    expect(state.ball).toEqual({ x: 500, y: 320 });
    expect(state.turn).toBe("away");
    expect(state.restart).toEqual({ kind: "kickoff" });
    expect(state).toMatchObject({
      matchId: "m1",
      phase: "aiming",
      half: 1,
      firstKickoff: "away",
      score: { home: 0, away: 0 },
      shotDeclared: false,
      halfStartedAt: 123,
      turnStartedAt: 123,
      lastDecision: null,
      winner: null,
      seq: 0,
    });
    expect(posOf(state, "away-5")).toEqual({ x: 535, y: 320 });
  });
});

describe("canShoot", () => {
  it("allows only own buttons on own turn while aiming", () => {
    const state = game();
    expect(canShoot(state, "home", "home-1")).toBe(true);
    expect(canShoot(state, "home", "home-gk")).toBe(false);
    expect(canShoot(state, "home", "away-1")).toBe(false);
    expect(canShoot(state, "away", "away-1")).toBe(false);
  });

  it("allows only the kicker during a penalty", () => {
    const state = penaltyState({ phase: "aiming", turn: "home" });
    const kickerId =
      state.restart?.kind === "penalty" ? state.restart.kickerId : null;
    const others = state.pieces.filter(
      (p) => p.team === "home" && p.kind === "button" && p.id !== kickerId,
    );
    expect(kickerId && canShoot(state, "home", kickerId)).toBe(true);
    expect(others.some((p) => canShoot(state, "home", p.id))).toBe(false);
  });
});

describe("shoot", () => {
  it("rejects non-finite and too-short pulls; caps long pulls", () => {
    const state = game({ restart: null });
    expect(errorOf(shoot(state, "home", "home-2", vec(Number.NaN, 0), 1))).toBe(
      "invalidPull",
    );
    expect(errorOf(shoot(state, "home", "home-2", vec(Infinity, 0), 1))).toBe(
      "invalidPull",
    );
    expect(errorOf(shoot(state, "home", "home-2", vec(3, 4), 1))).toBe(
      "invalidPull",
    );
    expect(shoot(state, "home", "home-2", vec(0, 10_000), 1).ok).toBe(true);
  });

  it("rejects shots out of turn, with invalid pieces, in the wrong phase and after full time", () => {
    const state = game();
    expect(errorOf(shoot(state, "away", "away-1", MIN_PULL, 1))).toBe(
      "notYourTurn",
    );
    expect(errorOf(shoot(state, "home", "home-gk", MIN_PULL, 1))).toBe(
      "invalidPiece",
    );
    expect(errorOf(shoot(state, "home", "away-1", MIN_PULL, 1))).toBe(
      "invalidPiece",
    );
    expect(
      errorOf(
        shoot(game({ phase: "keeperSetup" }), "home", "home-1", MIN_PULL, 1),
      ),
    ).toBe("wrongPhase");
    expect(
      errorOf(
        shoot(game({ phase: "finished" }), "home", "home-1", MIN_PULL, 1),
      ),
    ).toBe("matchFinished");
  });

  it("alternates turns after a normal shot", () => {
    const state = game({ restart: null });
    const { state: next, replay } = unwrap(
      shoot(state, "home", "home-2", MIN_PULL, 5000),
    );
    expect(next.turn).toBe("away");
    expect(next.seq).toBe(1);
    expect(next.restart).toBeNull();
    expect(next.turnStartedAt).toBe(5000);
    expect(next.lastDecision).toEqual({ kind: "play", pass: false });
    expect(replay.frameMs).toBeCloseTo(1000 / 60);
    expect(replay.frames.length).toBeGreaterThan(0);
    expect(posOf(next, "home-2")?.y).toBeLessThan(170);
  });

  it("retakes a kickoff when the ball never left the centre circle", () => {
    const { state: next } = unwrap(
      shoot(game(), "home", "home-2", MIN_PULL, 1),
    );
    expect(next.lastDecision).toEqual({ kind: "kickoffRetake" });
    expect(next.turn).toBe("home");
    expect(next.restart).toEqual({ kind: "kickoff" });
    expect(posOf(next, "home-2")).toEqual({ x: 260, y: 170 });
  });

  it("resets to kickoff for the conceding team after a goal", () => {
    const state = game({
      restart: null,
      shotDeclared: true,
      ball: vec(850, 320),
      pieces: [
        piece("home-1", 800, 320),
        piece("home-gk", 9, 320),
        piece("away-gk", 991, 240),
      ],
    });
    const { state: next } = unwrap(
      shoot(state, "home", "home-1", vec(-160, 0), 1),
    );
    expect(next.lastDecision).toEqual({
      kind: "goal",
      scorer: "home",
      ownGoal: false,
    });
    expect(next.score).toEqual({ home: 1, away: 0 });
    expect(next.turn).toBe("away");
    expect(next.restart).toEqual({ kind: "kickoff" });
    expect(next.shotDeclared).toBe(false);
    expect(next.ball).toEqual({ x: 500, y: 320 });
    expect(next.pieces).toHaveLength(12);
    expect(posOf(next, "away-5")).toEqual({ x: 535, y: 320 });
  });

  it("awards a goal kick when an undeclared shot goes in", () => {
    const state = game({
      restart: null,
      ball: vec(850, 320),
      pieces: [
        piece("home-1", 800, 320),
        piece("home-gk", 9, 320),
        piece("away-gk", 991, 240),
      ],
    });
    const { state: next } = unwrap(
      shoot(state, "home", "home-1", vec(-160, 0), 1),
    );
    expect(next.lastDecision).toEqual({
      kind: "goalDisallowed",
      awardedTo: "away",
    });
    expect(next.score).toEqual({ home: 0, away: 0 });
    expect(next.turn).toBe("away");
    expect(next.restart).toEqual({ kind: "goalKick" });
    expect(next.ball).toEqual({ x: 940, y: 320 });
  });

  it("awards a throw-in at the exit point to the opponent of the last toucher", () => {
    const state = game({
      restart: null,
      ball: vec(500, 610),
      pieces: [
        piece("home-1", 500, 560),
        piece("home-gk", 9, 320),
        piece("away-gk", 991, 320),
      ],
    });
    const { state: next } = unwrap(
      shoot(state, "home", "home-1", vec(0, -160), 1),
    );
    expect(next.lastDecision).toMatchObject({
      kind: "out",
      restart: "throwIn",
      awardedTo: "away",
    });
    expect(next.turn).toBe("away");
    expect(next.restart).toEqual({ kind: "throwIn" });
    expect(next.ball.y).toBe(640);
    expect(next.pieces.every((p) => p.pos.y <= 640)).toBe(true);
  });

  it("turns a foul in the own penalty area into a penalty with keeper setup for the fouling team", () => {
    const state = game({
      restart: null,
      ball: vec(500, 600),
      pieces: [
        piece("home-1", 130, 300),
        piece("home-gk", 9, 320),
        piece("away-1", 70, 300),
        piece("away-2", 700, 100),
        piece("away-gk", 991, 320),
      ],
    });
    const { state: next } = unwrap(
      shoot(state, "home", "home-1", vec(160, 0), 1),
    );
    expect(next.lastDecision).toMatchObject({
      kind: "foul",
      awardedTo: "away",
      penalty: true,
    });
    expect(next.phase).toBe("keeperSetup");
    expect(next.turn).toBe("home");
    expect(next.shotDeclared).toBe(true);
    expect(next.restart).toEqual({ kind: "penalty", kickerId: "away-1" });
    expect(next.ball).toEqual({ x: 110, y: 320 });
  });

  it("awards a free kick for a foul outside the penalty area", () => {
    const state = game({
      restart: null,
      ball: vec(500, 600),
      pieces: [
        piece("home-1", 400, 300),
        piece("home-gk", 9, 320),
        piece("away-1", 340, 300),
        piece("away-gk", 991, 320),
      ],
    });
    const { state: next } = unwrap(
      shoot(state, "home", "home-1", vec(160, 0), 1),
    );
    expect(next.lastDecision).toMatchObject({
      kind: "foul",
      awardedTo: "away",
      penalty: false,
    });
    expect(next.phase).toBe("aiming");
    expect(next.turn).toBe("away");
    expect(next.restart).toEqual({ kind: "freeKick" });
    expect(next.ball).toEqual(
      next.lastDecision?.kind === "foul" ? next.lastDecision.at : null,
    );
  });

  it("does not mutate the input state", () => {
    const state = game({ restart: null });
    const snapshot = structuredClone(state);
    shoot(state, "home", "home-2", MIN_PULL, 1);
    expect(state).toEqual(snapshot);
  });
});

describe("declared shot flow", () => {
  it("lets the defender set the keeper, then the attacker shoot", () => {
    const declared = unwrap(declareShot(attackingState(), "home", 10));
    expect(declared).toMatchObject({
      phase: "keeperSetup",
      turn: "away",
      turnStartedAt: 10,
      seq: 1,
    });

    const moved = unwrap(moveKeeper(declared, "away", 300));
    expect(posOf(moved, "away-gk")).toEqual({ x: 991, y: 300 });
    expect(moved.seq).toBe(1);

    const confirmed = unwrap(confirmKeeper(moved, "away", 20));
    expect(confirmed).toMatchObject({
      phase: "aiming",
      turn: "home",
      shotDeclared: true,
      turnStartedAt: 20,
      seq: 2,
    });
  });

  it("clamps the keeper to the goal mouth and rejects non-finite positions", () => {
    const declared = unwrap(declareShot(attackingState(), "home", 10));
    expect(
      posOf(unwrap(moveKeeper(declared, "away", 9999)), "away-gk")?.y,
    ).toBe(400);
    expect(errorOf(moveKeeper(declared, "away", Number.NaN))).toBe(
      "invalidKeeperPosition",
    );
    expect(errorOf(moveKeeper(declared, "home", 300))).toBe("notYourTurn");
    expect(errorOf(moveKeeper(attackingState(), "home", 300))).toBe(
      "wrongPhase",
    );
    expect(errorOf(confirmKeeper(declared, "home", 20))).toBe("notYourTurn");
    expect(errorOf(confirmKeeper(attackingState(), "home", 20))).toBe(
      "wrongPhase",
    );
  });

  it("rejects invalid declarations", () => {
    expect(errorOf(declareShot(game({ restart: null }), "home", 1))).toBe(
      "shotNotAllowed",
    );
    expect(errorOf(declareShot(attackingState(), "away", 1))).toBe(
      "notYourTurn",
    );
    expect(
      errorOf(
        declareShot({ ...attackingState(), phase: "keeperSetup" }, "home", 1),
      ),
    ).toBe("wrongPhase");
    expect(
      errorOf(
        declareShot({ ...attackingState(), shotDeclared: true }, "home", 1),
      ),
    ).toBe("shotNotAllowed");
  });
});

describe("canDeclareShot", () => {
  it("is true only in the attacking half on own turn", () => {
    expect(canDeclareShot(attackingState(), "home")).toBe(true);
    expect(canDeclareShot(attackingState(), "away")).toBe(false);
    expect(
      canDeclareShot(game({ restart: null, ball: vec(300, 320) }), "home"),
    ).toBe(false);
    expect(canDeclareShot(game({ restart: null }), "home")).toBe(false);
  });

  it("is false during a penalty", () => {
    expect(
      canDeclareShot(penaltyState({ phase: "aiming", turn: "home" }), "home"),
    ).toBe(false);
  });
});

describe("advanceClock", () => {
  it("returns the same reference when nothing changes", () => {
    const state = game();
    expect(advanceClock(state, 29_999)).toBe(state);
    const finished = game({ phase: "finished", winner: "draw" });
    expect(advanceClock(finished, 10_000_000)).toBe(finished);
  });

  it("passes the turn and any pending restart after 30 s", () => {
    const next = advanceClock(game(), 30_000);
    expect(next).toMatchObject({
      turn: "away",
      restart: null,
      shotDeclared: false,
      lastDecision: { kind: "turnTimeout", team: "home" },
      turnStartedAt: 30_000,
      seq: 1,
    });
  });

  it("auto-confirms the keeper after 15 s", () => {
    const declared = unwrap(declareShot(attackingState(), "home", 1000));
    expect(advanceClock(declared, 15_999)).toBe(declared);
    const next = advanceClock(declared, 16_000);
    expect(next).toMatchObject({
      phase: "aiming",
      turn: "home",
      shotDeclared: true,
      turnStartedAt: 16_000,
      seq: 2,
    });
  });

  it("swaps sides at half time and gives the kickoff to the other team", () => {
    const state = game({
      restart: null,
      score: { home: 1, away: 0 },
      turnStartedAt: 590_000,
      seq: 7,
    });
    const next = advanceClock(state, 600_000);
    expect(next).toMatchObject({
      half: 2,
      phase: "aiming",
      turn: "away",
      restart: { kind: "kickoff" },
      score: { home: 1, away: 0 },
      shotDeclared: false,
      halfStartedAt: 600_000,
      turnStartedAt: 600_000,
      lastDecision: { kind: "halfTime" },
      seq: 8,
    });
    expect(posOf(next, "home-gk")?.x).toBe(991);
    expect(posOf(next, "away-5")).toEqual({ x: 465, y: 320 });
    expect(next.ball).toEqual({ x: 500, y: 320 });
  });

  it("ends the match at full time with a winner or a draw", () => {
    const second = game({
      half: 2,
      halfStartedAt: 600_000,
      turnStartedAt: 1_190_000,
      seq: 3,
    });
    const won = advanceClock(
      { ...second, score: { home: 1, away: 2 } },
      1_200_000,
    );
    expect(won).toMatchObject({
      phase: "finished",
      winner: "away",
      lastDecision: { kind: "fullTime" },
      seq: 4,
    });
    expect(advanceClock(second, 1_200_000).winner).toBe("draw");
  });

  it("ends the half during keeper setup of a declared shot", () => {
    const declared = unwrap(declareShot(attackingState(), "home", 595_000));
    expect(advanceClock(declared, 600_000).half).toBe(2);
  });

  it("waits for a pending penalty before ending the half", () => {
    const state = penaltyState({ turnStartedAt: 595_000 });
    expect(advanceClock(state, 600_000)).toBe(state);

    const aiming = unwrap(confirmKeeper(state, "away", 600_000));
    expect(advanceClock(aiming, 601_000)).toBe(aiming);

    const kickerId: PieceId =
      state.restart?.kind === "penalty" ? state.restart.kickerId : "home-1";
    const { state: taken } = unwrap(
      shoot(aiming, "home", kickerId, vec(-160, 0), 602_000),
    );
    expect(taken.restart?.kind).not.toBe("penalty");
    expect(advanceClock(taken, 602_000)).toMatchObject({
      half: 2,
      lastDecision: { kind: "halfTime" },
    });
  });
});
