# Shared Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, deterministic, fully tested TypeScript engine for 5v5 turn-based table football (pitch geometry, physics, referee, game state machine, socket contracts) shared by `api` and `game`.

**Architecture:** New npm workspace `shared/` (`@sectorball/shared`) exporting `.ts` sources directly (no build; Node type stripping and Vite both consume it). No I/O, no randomness, no clock reads inside — time (`now`) and coin toss are passed in. The server runs it authoritatively; the client uses its types, constants and `canShoot`/`canDeclareShot` selectors.

**Tech Stack:** TypeScript ~6.0, Vitest 5, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-17-sectorball-design.md`

## Global Constraints
- All numbers (sizes, physics, timing) come from `shared/src/constants.ts` exactly as listed in the spec; no magic numbers elsewhere.
- Pure functions only: never mutate inputs, never call `Date.now()`/`Math.random()` inside `shared/src`.
- Project rules: no `enum`, no default exports, `import type` for types, `.ts` extensions in relative imports (Node type stripping).
- `shared` must satisfy `npm run lint && npm run typecheck && npm test` (husky runs them on commit).
- Skills to follow: `typescript`, `vitest-tdd`, `dry`, `kiss`, `solid`, `npm-workspaces`.

## Review Focus
1. Two bodies starting the shot already overlapping (e.g. after a bad restart placement) — the simulation must separate them without NaN/explosive speeds. → Task 4 test `separates initially overlapping bodies without NaN`.
2. Hostile/garbage pull vectors from a client (`NaN`, `Infinity`, zero, huge) — must be rejected or capped, never simulated. → Task 7 test `rejects non-finite and too-short pulls; caps long pulls`.
3. Clock running out during a keeper setup or with a penalty pending — half must end correctly (penalty still taken). → Task 7 tests in `advanceClock`.
4. Restart placement putting the ball on top of a button or a button outside the field — must resolve to a legal, non-overlapping layout. → Task 6 test `resolves overlaps after placing the ball`.
5. Shot that ends with the ball resting exactly on the halfway line or centre-circle edge (kickoff retake / declare-shot boundaries) — strict comparisons must be used consistently. → Task 2 test `halfway line belongs to nobody's attacking half`.

---

## File Structure
```
shared/
  package.json            # @sectorball/shared, exports "./src/index.ts"
  tsconfig.json           # extends ../tsconfig.base.json (nodenext, erasableSyntaxOnly)
  vitest.config.ts
  src/
    index.ts              # public barrel
    geometry.ts           # Vec + vector math
    constants.ts          # every number from the spec
    types.ts              # Team, Piece, GameState, Decision, Replay, Result, GameError
    field.ts              # sides, areas, formation, keeper range, clamping
    physics.ts            # shotVelocity, simulate
    referee.ts            # judgeShot
    restarts.ts           # ball/piece placement for restarts, resolveOverlaps
    game.ts               # createGame, shoot, declareShot, moveKeeper, confirmKeeper, advanceClock, selectors
    events.ts             # Socket.IO contracts + MatchView DTOs
    *.test.ts             # next to each module
```

---

### Task 1: `shared` workspace, geometry, constants, types

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/vitest.config.ts`, `shared/src/index.ts`, `shared/src/geometry.ts`, `shared/src/constants.ts`, `shared/src/types.ts`
- Modify: root `package.json` (`"workspaces": ["shared", "game", "api"]`)
- Test: `shared/src/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type Vec = { readonly x: number; readonly y: number }`; `vec(x, y)`, `add(a, b)`, `sub(a, b)`, `scale(v, k)`, `dot(a, b)`, `length(v)`, `distance(a, b)`, `normalize(v)` (zero vector → `{0,0}`), `clampLength(v, max)`, `isFiniteVec(v)` — all `(…) => Vec | number | boolean` as named.
  - `constants.ts`: `FIELD = { width: 1000, height: 640, margin: 40 }`, `GOAL = { mouthTop: 240, mouthBottom: 400, depth: 30, postRadius: 4 }`, `PENALTY_AREA = { depth: 150, top: 140, bottom: 500 }`, `PENALTY_SPOT_DISTANCE = 110`, `CENTER = { x: 500, y: 320, circleRadius: 90 }`, `PIECE = { buttonRadius: 22, ballRadius: 10, keeperWidth: 14, keeperHeight: 56, keeperLineOffset: 9 }`, `PHYSICS = { dt: 1/120, buttonDecel: 900, ballDecel: 1000, restitution: 0.9, keeperRestitution: 0.7, postRestitution: 0.6, buttonMass: 1, ballMass: 0.5, maxShotSpeed: 1100, stopSpeed: 2, maxSteps: 2400, frameEvery: 2 }`, `SHOT = { minPull: 10, maxPull: 160 }`, `TIMING = { halfLengthMs: 600_000, turnLimitMs: 30_000, keeperSetupLimitMs: 15_000 }`, `RESTART = { freeKickDistance: 60, goalKickDistance: 60, penaltyKickerOffset: 40 }` — all `as const`.
  - `types.ts`:
    ```ts
    export type Team = 'home' | 'away';
    export type Side = 'left' | 'right';
    export type PieceId = `${Team}-${1 | 2 | 3 | 4 | 5}` | `${Team}-gk`;
    export type Piece = { readonly id: PieceId; readonly team: Team; readonly kind: 'button' | 'keeper'; readonly pos: Vec };
    export type Restart =
      | { readonly kind: 'kickoff' } | { readonly kind: 'freeKick' } | { readonly kind: 'throwIn' }
      | { readonly kind: 'corner' } | { readonly kind: 'goalKick' }
      | { readonly kind: 'penalty'; readonly kickerId: PieceId };
    export type Phase = 'aiming' | 'keeperSetup' | 'finished';
    export type Decision =
      | { readonly kind: 'play'; readonly pass: boolean }
      | { readonly kind: 'goal'; readonly scorer: Team; readonly ownGoal: boolean }
      | { readonly kind: 'goalDisallowed'; readonly awardedTo: Team }
      | { readonly kind: 'foul'; readonly awardedTo: Team; readonly at: Vec; readonly penalty: boolean }
      | { readonly kind: 'out'; readonly restart: 'throwIn' | 'corner' | 'goalKick'; readonly awardedTo: Team; readonly at: Vec }
      | { readonly kind: 'kickoffRetake' }
      | { readonly kind: 'turnTimeout'; readonly team: Team }
      | { readonly kind: 'halfTime' } | { readonly kind: 'fullTime' };
    export type GameState = {
      readonly matchId: string; readonly phase: Phase; readonly half: 1 | 2; readonly turn: Team;
      readonly firstKickoff: Team; readonly score: Readonly<Record<Team, number>>;
      readonly pieces: readonly Piece[]; readonly ball: Vec; readonly restart: Restart | null;
      readonly shotDeclared: boolean; readonly halfStartedAt: number; readonly turnStartedAt: number;
      readonly lastDecision: Decision | null; readonly winner: Team | 'draw' | null; readonly seq: number;
    };
    export type Frame = Readonly<Record<string, readonly [number, number]>>; // body id ('ball' | PieceId) → [x, y]
    export type Replay = { readonly frames: readonly Frame[]; readonly frameMs: number };
    export type GameError = 'notYourTurn' | 'wrongPhase' | 'invalidPiece' | 'invalidPull' | 'shotNotAllowed'
      | 'invalidKeeperPosition' | 'matchFinished' | 'staleState';
    export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: GameError };
    export const other = (team: Team): Team => (team === 'home' ? 'away' : 'home');
    ```

- [ ] **Step 1: Scaffold the workspace** — `shared/package.json`: `"name": "@sectorball/shared"`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, scripts `typecheck`/`lint`/`test`/`test:watch` as in `api`; devDeps `typescript@~6.0.3`, `vitest@^5.0.5`, `@types/node@^22.18.0` (`npm install -D … -w shared`; Node types are only needed for `vitest.config.ts` — `src/` must not import `node:*`). `tsconfig.json` is a copy of `api/tsconfig.json` (include `["src", "vitest.config.ts"]`). `vitest.config.ts` environment `node`, include `src/**/*.test.ts`. Add `"shared"` first in root `"workspaces"`, run `npm install`.
- [ ] **Step 2: Write the failing test** `geometry.test.ts`:
  ```ts
  it('normalize keeps direction and returns zero for the zero vector', () => {
    expect(normalize(vec(3, 4))).toEqual(vec(0.6, 0.8));
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0));
  });
  it('clampLength caps only longer vectors', () => {
    expect(clampLength(vec(300, 400), 100)).toEqual(vec(60, 80));
    expect(clampLength(vec(3, 4), 100)).toEqual(vec(3, 4));
  });
  it('isFiniteVec rejects NaN and Infinity', () => {
    expect(isFiniteVec(vec(1, 2))).toBe(true);
    expect(isFiniteVec(vec(Number.NaN, 0))).toBe(false);
    expect(isFiniteVec(vec(0, Infinity))).toBe(false);
  });
  ```
- [ ] **Step 3: Run** `npm test -w shared` → FAIL (module not found).
- [ ] **Step 4: Implement** `geometry.ts`, `constants.ts`, `types.ts` with the exact interfaces above; `index.ts` re-exports all modules (`export * from './geometry.ts'` …).
- [ ] **Step 5: Run** `npm test -w shared && npm run typecheck -w shared && npm run lint -w shared` → PASS.
- [ ] **Step 6: Commit** `feat(shared): add shared workspace with geometry, constants and types`.

---

### Task 2: Field helpers and formations

**Files:** Create `shared/src/field.ts`; Test `shared/src/field.test.ts`

**Interfaces:**
- Consumes: Task 1 types/constants.
- Produces:
  - `defendedSide(team: Team, half: 1 | 2): Side` — half 1: home → `'left'`; half 2 swapped.
  - `ownerOfSide(side: Side, half: 1 | 2): Team`
  - `goalLineX(side: Side): number` (0 | 1000)
  - `isInAttackingHalf(pos: Vec, team: Team, half: 1 | 2): boolean` — strictly beyond x = 500 toward the opponent goal.
  - `isInPenaltyArea(pos: Vec, side: Side): boolean` — inclusive box (left: x ∈ [0,150], y ∈ [140,500]).
  - `penaltySpot(side: Side): Vec` — left `(110, 320)`, right `(890, 320)`.
  - `keeperX(side: Side): number` — `9` / `991`; `clampKeeperY(y: number): number` → [240, 400].
  - `isInsideField(pos: Vec): boolean` (inclusive), `clampToField(pos: Vec): Vec` (onto [0,1000]×[0,640]).
  - `formation(team: Team, half: 1 | 2, kickoff: boolean): Piece[]` — 5 buttons + keeper. For the left side, buttons 1–5 at `(150,320)`, `(260,170)`, `(260,470)`, `(400,250)`, `(400,390)`; if `kickoff`, button 5 is at `(465,320)` instead. Right side mirrors x → `1000 - x`. Keeper at `(keeperX(side), 320)`.

- [ ] **Step 1: Write failing tests:**
  - `defendedSide` table: `('home',1)→'left'`, `('away',1)→'right'`, `('home',2)→'right'`.
  - `halfway line belongs to nobody's attacking half`: `isInAttackingHalf(vec(500,320),'home',1)` and `('away',1)` both `false`; `vec(501,320)` true for home in half 1, false in half 2.
  - `isInPenaltyArea(vec(150,140),'left')` true, `vec(151,320)` false, `vec(900,320),'right'` true.
  - `formation('away',1,true)` has ids `away-1…away-5, away-gk`, `away-5` at `(535,320)`, keeper at `(991,320)`, every button `x >= 500`.
  - Kickoff opponents are outside the centre circle: every `formation('home',1,false)` button has `distance(pos, CENTER) > CENTER.circleRadius`.
  - `clampKeeperY(100) === 240`, `clampKeeperY(999) === 400`; `clampToField(vec(-20, 700))` → `(0, 640)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `field.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shared): add field helpers and formations`.

---

### Task 3: Shot velocity and free movement

**Files:** Create `shared/src/physics.ts`; Test `shared/src/physics.test.ts`

**Interfaces:**
- Produces:
  - `shotVelocity(pull: Vec): Vec` = `scale(normalize(pull), -min(|pull|, SHOT.maxPull) / SHOT.maxPull * PHYSICS.maxShotSpeed)`.
  - `type Contact = { readonly step: number; readonly a: string; readonly b: string; readonly at: Vec }` (ids: `'ball'`, a `PieceId`, `'post'`).
  - `type BallExit = { readonly kind: 'goal'; readonly side: Side; readonly at: Vec } | { readonly kind: 'out'; readonly line: 'touchline' | 'goalline'; readonly side: Side; readonly at: Vec }` (`side` = the goal-line side for goal/goalline; for touchline the half of the field where it left: `at.x < 500 ? 'left' : 'right'`).
  - `type SimResult = { readonly frames: Frame[]; readonly contacts: Contact[]; readonly ballExit: BallExit | null; readonly ballLeftCenterCircle: boolean; readonly pieces: Piece[]; readonly ball: Vec }` — `pieces`/`ball` are the final rest positions (buttons clamped with `clampToField`; ball = exit point if it left play).
  - `simulate(pieces: readonly Piece[], ball: Vec, shooterId: PieceId, velocity: Vec): SimResult`

  Integration per step (dt = `PHYSICS.dt`): `pos += vel·dt`, then speed reduced by `decel·dt` (never below 0, direction kept). Keepers never move. Stop when all speeds `< PHYSICS.stopSpeed` or after `PHYSICS.maxSteps`. Push a frame of every non-keeper body every `frameEvery` steps and once at the end, coordinates rounded to 1 decimal.

- [ ] **Step 1: Failing tests:**
  - `shotVelocity(vec(-100, 0))` → `(687.5, 0)`; `shotVelocity(vec(0, 1000))` → `(0, -1100)` (capped).
  - `a lone button slides opposite to the pull and stops`: single `home-1` at `(100,320)` (all other pieces far away / omitted), velocity `shotVelocity(vec(-100,0))` → final `home-1.x` within `±5` of `100 + 687.5²/(2·900)` (≈ 362.6), `y === 320`; `contacts` empty; last frame equals final position.
  - `frames are sampled at 60 fps`: `frames.length` ≈ `steps / 2` (assert `> 50` and every frame has keys for all non-keeper bodies incl. `'ball'`).
  - `simulate does not mutate its inputs` (deep-freeze input arrays, compare).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** movement-only `simulate`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shared): add shot velocity and frictional movement`.

---

### Task 4: Collisions, goals and outs

**Files:** Modify `shared/src/physics.ts`; Test `shared/src/physics.collisions.test.ts`

**Interfaces:** Extends `simulate` from Task 3 (same signature).

Collision handling after each integration step, in this order:
1. Circle–circle for every pair of moving-capable bodies (buttons, ball): if overlapping, push apart along the normal weighted by inverse mass; if approaching, apply impulse `j = -(1+e)·(v_rel·n)/(1/m₁+1/m₂)` with `e = PHYSICS.restitution`; record a `Contact` (contact point = midpoint between surfaces) once per impulse.
2. Circle–keeper (static 14×56 rectangle centred on the keeper `pos`): closest-point test, push out, reflect the normal velocity with `keeperRestitution`, record contact `{ a: bodyId, b: keeperId }`.
3. Circle–post (static circles radius 4 at `(goalLineX, 240)` and `(goalLineX, 400)` on both sides): same with `postRestitution`, `b: 'post'`.
4. Ball exit: after the step, if ball centre `x < -ballRadius` or `x > 1000 + ballRadius`: `goal` if `240 < y < 400`, else `out/goalline`; if `y < -ballRadius` or `y > 640 + ballRadius`: `out/touchline`. The exit point `at` is the ball centre clamped onto the field rectangle. Once the ball exits it is removed from the simulation (other bodies continue).
5. `ballLeftCenterCircle` becomes true the first step the ball centre is farther than 90 from `CENTER`, or when it exits.

- [ ] **Step 1: Failing tests** (build minimal scenes with a helper `scene(pieces, ball)`):
  - `head-on button hits the ball and the ball moves on`: `home-4` at `(400,320)`, ball `(440,320)`, shoot `+x` → first contact `{a:'home-4', b:'ball'}` (order-insensitive), final `ball.x > 500`.
  - `ball into the right goal between the posts`: ball `(950,320)`, shooter `home-4` at `(910,320)` full power `+x` → `ballExit.kind === 'goal'`, `side === 'right'`.
  - `ball wide of the post is out over the goal line`: same but ball/shooter at `y = 100` → `{ kind: 'out', line: 'goalline', side: 'right' }`.
  - `ball over the touchline`: shooter `(500,600)`, ball `(500,620)`, shoot `+y` → `{ kind: 'out', line: 'touchline' }`, `at.y === 640`.
  - `keeper blocks a centred shot`: right keeper at `(991,320)`, ball `(900,320)`, shooter `(860,320)` `+x` → `ballExit === null` or not `'goal'`; contacts include `{ b: 'away-gk' }`; keeper position unchanged.
  - `ballLeftCenterCircle` false for a tiny tap at the centre, true for a full-power kickoff.
  - `separates initially overlapping bodies without NaN`: two buttons at the same point ± 1 unit → all final coordinates finite, distance ≥ 44 − 0.5.
  - `is deterministic`: two runs with the same input are `toEqual`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (also Task 3 tests).
- [ ] **Step 5: Commit** `feat(shared): add collisions, goal and out detection`.

---

### Task 5: Referee

**Files:** Create `shared/src/referee.ts`; Test `shared/src/referee.test.ts`

**Interfaces:**
- Consumes: `SimResult`, `GameState`, field helpers.
- Produces: `judgeShot(state: GameState, shooter: Piece, sim: SimResult): Decision` — priority exactly as the spec "Rules" list:
  1. **Foul**: walk `sim.contacts` in order; consider contacts involving `shooter.id`. If the first such contact is with an opponent **button** (not keeper, not ball, not post) → `foul`, `awardedTo = other(shooter.team)`, `at = contact.at`, `penalty = isInPenaltyArea(at, defendedSide(shooter.team, state.half))`. Contacts after the shooter has touched the ball are never fouls.
  2. **Goal** (`ballExit.kind === 'goal'`): goal owner `T = ownerOfSide(side, half)`; `scorer = other(T)`; `ownGoal = shooter.team === T`. Valid if `ownGoal || state.shotDeclared || state.restart?.kind === 'penalty'`; otherwise `goalDisallowed` with `awardedTo = T`.
  3. **Out**: last toucher = team of the last contact between `'ball'` and a piece (fallback: shooter). Touchline → `throwIn` for `other(lastTouch)`. Goal line: defender `T = ownerOfSide(side, half)`; `lastTouch === T` → `corner` for `other(T)`, else `goalKick` for `T`. `at = ballExit.at`.
  4. **Kickoff retake**: `state.restart?.kind === 'kickoff' && !sim.ballLeftCenterCircle` → `kickoffRetake`.
  5. Otherwise `play`, `pass = true` if, after the shooter's first ball contact, the ball contacts another button of the shooter's team.

- [ ] **Step 1: Failing tests** — construct `SimResult` objects by hand (no physics needed) via a `fakeSim({ contacts, ballExit, ballLeftCenterCircle })` helper and a `baseState()` from `createGame`-free literal:
  - foul outside the box → `{ kind:'foul', awardedTo:'away', penalty:false }`; foul inside home's own box (half 1, contact at `(100,320)`) → `penalty: true`.
  - shooter touches ball first then an opponent → not a foul (`play`).
  - undeclared shot into the goal → `goalDisallowed` `awardedTo` = goal owner; declared → `goal` with correct `scorer`; own goal undeclared → `goal`, `ownGoal: true`.
  - penalty restart counts without declaration.
  - out cases: touchline last touched by home → `throwIn` for away; goal line on away's side last touched by away → `corner` for home; last touched by home → `goalKick` for away.
  - kickoff with ball staying inside the circle → `kickoffRetake`; leaving it → `play`.
  - pass: contacts `[home-4↔ball, ball↔home-2]` → `play, pass: true`; `[home-4↔ball, ball↔away-1]` → `pass: false`.
  - foul takes priority over a goal in the same shot.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shared): add referee decisions`.

---

### Task 6: Restart placement

**Files:** Create `shared/src/restarts.ts`; Test `shared/src/restarts.test.ts`

**Interfaces:**
- Produces (all return new `{ pieces: Piece[]; ball: Vec }` layouts):
  - `resolveOverlaps(pieces: readonly Piece[], ball: Vec, fixedBall: boolean): Piece[]` — iteratively (max 20 passes) push overlapping buttons apart / away from the ball (buttons ≥ `22+22`, ball ≥ `22+10` + 1 unit gap), keepers and the ball never move, then `clampToField`.
  - `placeFreeKick(pieces, at: Vec, awardedTo: Team)` — ball at `at` (clamped into field); opponent buttons of `awardedTo` closer than `RESTART.freeKickDistance` pushed radially out to that distance; then `resolveOverlaps`. Also used for **throw-in** and **corner** (with `at` = line point / corner point).
  - `cornerPoint(side: Side, exitY: number): Vec` → `(side === 'left' ? 10 : 990, exitY < 320 ? 10 : 630)`.
  - `goalKickPoint(side: Side): Vec` → `(goalLineX(side) ± 60, 320)` toward the field.
  - `placePenalty(pieces, foulingTeam: Team, half: 1 | 2, kickerTeam: Team): { pieces: Piece[]; ball: Vec; kickerId: PieceId }` — ball on `penaltySpot(defendedSide(foulingTeam, half))`; every button inside that area is moved along x to just outside the area line (`150 + 22` / `850 − 22`); kicker = the `kickerTeam` button nearest to the spot, placed `RESTART.penaltyKickerOffset` from the spot on the field side; then `resolveOverlaps`.

- [ ] **Step 1: Failing tests:**
  - `resolves overlaps after placing the ball`: ball placed on top of `home-2` → no button within 33 of the ball, no two buttons within 44, all inside field.
  - free kick for away at `(600,300)` with `home-1` at `(620,300)` → home-1 now ≥ 60 from the ball; away buttons untouched unless overlapping.
  - penalty against home in half 1: ball `(110,320)`; no button except the kicker has `x ≤ 150` inside y∈[140,500]; kicker is an `away` button at `(150,320)`; keeper `home-gk` unchanged.
  - `cornerPoint('right', 600)` → `(990,630)`; `goalKickPoint('left')` → `(60,320)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shared): add restart placement`.

---

### Task 7: Game state machine

**Files:** Create `shared/src/game.ts`; Test `shared/src/game.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `createGame(input: { matchId: string; firstKickoff: Team; now: number }): GameState` — half 1, `phase 'aiming'`, `turn = firstKickoff`, kickoff formations (kicking team `kickoff: true`), ball at `CENTER`, `restart: { kind: 'kickoff' }`, score 0–0, `seq 0`, `halfStartedAt = turnStartedAt = now`.
  - `canShoot(state: GameState, team: Team, pieceId: PieceId): boolean` — phase `aiming`, turn is `team`, piece is an own button, and during a penalty only `restart.kickerId`.
  - `canDeclareShot(state: GameState, team: Team): boolean` — phase `aiming`, own turn, `!shotDeclared`, restart not `penalty`, `isInAttackingHalf(ball, team, half)`.
  - `shoot(state, team, pieceId, pull, now): Result<{ state: GameState; replay: Replay }>` — errors: `matchFinished`, `wrongPhase`, `notYourTurn`, `invalidPiece` (via `canShoot`), `invalidPull` (`!isFiniteVec(pull)` or `length < SHOT.minPull`; longer pulls are capped by `shotVelocity`). Runs `simulate` → `judgeShot` → applies the decision:
    - `play`: `turn = other(team)`, `restart = null`, sim positions.
    - `goal`: score +1 for `scorer`; fresh formations with kickoff for the conceding team; `restart kickoff`; `turn` = conceding team.
    - `goalDisallowed` / `out`: placement via `placeFreeKick` at `goalKickPoint` / `cornerPoint` / exit point; `turn = awardedTo`; `restart` = `goalKick` / `corner` / `throwIn`.
    - `foul`: `placeFreeKick` or `placePenalty`; `turn = awardedTo`; penalty → `phase 'keeperSetup'` for the fouling side's keeper owner with `turn` = fouling team, `shotDeclared = true`, `restart = { kind: 'penalty', kickerId }`.
    - `kickoffRetake`: kickoff formations again, same `turn`.
    - Always: `shotDeclared` reset (except penalty), `lastDecision` set, `turnStartedAt = now`, `seq + 1`, `replay = { frames: sim.frames, frameMs: 1000 / 60 }`.
  - `declareShot(state, team, now): Result<GameState>` — requires `canDeclareShot` (else `shotNotAllowed` / `notYourTurn` / `wrongPhase`); → `phase 'keeperSetup'`, `turn = other(team)` (the defender acts), `turnStartedAt = now`, `seq + 1`.
  - `moveKeeper(state, team, y): Result<GameState>` — only in `keeperSetup` and `team === turn`; `y` must be finite (else `invalidKeeperPosition`); keeper `pos.y = clampKeeperY(y)`; `seq` unchanged.
  - `confirmKeeper(state, team, now): Result<GameState>` — only in `keeperSetup`, `team === turn`; → `phase 'aiming'`, `turn = other(team)`, `shotDeclared = true`, `turnStartedAt = now`, `seq + 1`.
  - `advanceClock(state, now): GameState` — returns the **same object** when nothing changes. Order:
    1. `finished` → unchanged.
    2. Half expired (`now − halfStartedAt ≥ TIMING.halfLengthMs`) and restart is not `penalty`: half 1 → half 2 with `firstKickoff`'s opponent kicking off, formations for half 2, score kept, `halfStartedAt = turnStartedAt = now`, `lastDecision halfTime`; half 2 → `phase 'finished'`, `winner` by score or `'draw'`, `lastDecision fullTime`.
    3. `keeperSetup` older than `keeperSetupLimitMs` → same as `confirmKeeper`.
    4. `aiming` older than `turnLimitMs` → `turn = other(turn)`, `restart = null`, `shotDeclared = false`, `lastDecision turnTimeout`, `turnStartedAt = now`, `seq + 1`.
- `seq` is the optimistic-concurrency token checked by the server (`staleState` is produced by the server, not here).

- [ ] **Step 1: Failing tests:**
  - `createGame` → 12 pieces, ball at `(500,320)`, turn = firstKickoff, restart kickoff.
  - `rejects non-finite and too-short pulls; caps long pulls`: `pull (NaN,0)` and `(3,4)` → `invalidPull`; `(0, 10_000)` → ok.
  - `notYourTurn`, `invalidPiece` (keeper id, opponent id), `matchFinished`.
  - `alternates turns after a normal shot` (tap a far-away button with min pull) → `turn` switches, `seq` 1.
  - `declared shot flow`: put ball in away half (craft state), `declareShot('home')` → keeperSetup, turn away; `moveKeeper('away', 300)` → keeper y 300; `confirmKeeper('away')` → aiming, turn home, `shotDeclared`.
  - `canDeclareShot` false in own half and during penalty.
  - `goal resets to kickoff for the conceding team` (crafted declared shot at an open goal) → score home 1, turn away, restart kickoff.
  - `advanceClock`: returns same reference when idle; turn timeout after 30 000 ms; keeper auto-confirm after 15 000 ms; half time at 600 000 ms swaps sides (home keeper now at x 991) and kickoff for `other(firstKickoff)`; full time sets `winner`; **penalty pending at expiry → half not ended** until the penalty shot is resolved (then the next `advanceClock` ends it).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shared): add game state machine`.

---

### Task 8: Socket contracts and DTOs

**Files:** Create `shared/src/events.ts`; Modify `shared/src/index.ts`; Test `shared/src/events.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlayerInfo = { readonly id: string; readonly nickname: string };
  export type MatchStatus = 'open' | 'live' | 'finished' | 'abandoned';
  export type MatchSummary = { readonly id: string; readonly status: MatchStatus; readonly home: PlayerInfo; readonly away: PlayerInfo | null; readonly createdAt: string };
  export type MatchView = MatchSummary & { readonly state: GameState | null; readonly connected: Readonly<Record<Team, boolean>> };
  export type AckResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string };
  export type Ack<T> = (res: AckResult<T>) => void;
  export interface ClientToServerEvents {
    'match:watch': (matchId: string, ack: Ack<MatchView>) => void;
    'game:shoot': (p: { matchId: string; seq: number; pieceId: PieceId; pull: Vec }, ack: Ack<null>) => void;
    'game:declareShot': (p: { matchId: string; seq: number }, ack: Ack<null>) => void;
    'game:moveKeeper': (p: { matchId: string; y: number }) => void;
    'game:confirmKeeper': (p: { matchId: string; seq: number }, ack: Ack<null>) => void;
  }
  export interface ServerToClientEvents {
    'match:updated': (view: MatchView) => void;
    'game:shot': (p: { matchId: string; replay: Replay; view: MatchView }) => void;
  }
  export const teamOf = (view: MatchSummary, playerId: string): Team | null => …;
  ```
- [ ] **Step 1: Failing test** for `teamOf` (home id → `'home'`, away id → `'away'`, stranger → `null`, open match with `away: null`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** + export from `index.ts`. **Step 4: Run** full `npm run lint && npm run typecheck && npm test` at root → PASS.
- [ ] **Step 5: Commit** `feat(shared): add socket event contracts and match DTOs`.
