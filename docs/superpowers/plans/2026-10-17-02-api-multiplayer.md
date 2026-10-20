# API Multiplayer Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tested Express 5 + Socket.IO backend that lets two guest players (one per browser) create/join a match and play it turn by turn, with the server running the shared engine authoritatively and SQLite persisting players and match records.

**Architecture:** `mvc-crud` layering in `api/src`: routes → controllers → services → models (repository interfaces + `node:sqlite` implementations). Socket handlers are thin controllers calling the same `matchService`. Live `GameState` lives in memory inside `matchService`; a 500 ms ticker calls `advanceClock`. Depends on plan 01 (`@sectorball/shared`).

**Tech Stack:** Node ≥ 22.18 (type stripping, `node:sqlite`), Express 5, Socket.IO 4.8, zod 4, Vitest 5 + supertest + socket.io-client.

**Spec:** `docs/superpowers/specs/2026-10-17-sectorball-design.md`

## Global Constraints
- Prerequisite: plan `2026-10-17-01-shared-engine.md` is merged (engine, `events.ts` contracts).
- Repositories are `async` interfaces (Promise-returning) even though `node:sqlite` is sync — the Supabase implementation will be async.
- Session tokens: 32 random bytes, base64url; only `sha256(token)` (hex) is stored. Header `Authorization: Bearer <token>`; socket `handshake.auth.token`.
- Nickname: trimmed, 2–20 characters.
- Domain errors → status codes in the central error handler: `ValidationError` 400, `UnauthorizedError` 401, `NotFoundError` 404, `ConflictError` 409. Error body `{ error: string }`.
- Engine `GameError` codes are passed through unchanged as the socket ack `error` string (and `staleState` when `seq` mismatches).
- Config (env, all optional): `PORT` 3000, `CLIENT_ORIGIN` `http://localhost:5173`, `DATABASE_PATH` `data/sectorball.db` (relative to `api/`).
- Skills to follow: `nodejs`, `expressjs`, `mvc-crud`, `socket-io`, `sqlite` (added in Task 1), `vitest-tdd`, `solid`.

## Review Focus
1. Browser reload / socket reconnect mid-match — the player must get the current view back and keep playing. → Task 6 test `a reconnecting player receives the current view`.
2. Double-click / duplicate or stale actions — only the first action for a given `seq` may apply. → Task 4 test `rejects actions with a stale seq`.
3. A third player joining a full match, or the creator joining their own match. → Task 4 tests `rejects joining a full match` / `rejects joining your own match`.
4. Socket payloads with wrong shapes or a non-participant sending actions. → Task 6 test `rejects malformed payloads and non-participants`.
5. Server restart while matches are live — stale `live` rows must not appear as playable. → Task 2 test `marks live matches abandoned on startup`.

---

## File Structure
```
.claude/skills/sqlite/SKILL.md                       # new project skill
.claude/skills/supabase/, supabase-postgres-best-practices/   # vendored (MIT) from supabase/agent-skills
api/src/
  config.ts                 # + databasePath
  errors.ts                 # domain errors
  db/sqlite.ts              # openDatabase(path) + migrations
  models/player.ts          # Player type + PlayerRepository interface
  models/match.ts           # MatchRecord type + MatchRepository interface
  models/sqlite/playerRepository.ts
  models/sqlite/matchRepository.ts
  services/sessionService.ts
  services/matchService.ts
  views/playerView.ts       # toPlayerInfo
  middleware/auth.ts        # requireAuth, getPlayer
  middleware/validate.ts    # validateBody(schema)
  controllers/sessionController.ts
  controllers/matchController.ts
  routes/sessions.ts
  routes/matches.ts
  sockets/schemas.ts        # zod schemas for socket payloads
  sockets/matchSockets.ts   # attachMatchSockets(io, deps)
  app.ts                    # createApp(deps)
  index.ts                  # wiring, ticker, shutdown
```

---

### Task 1: Skills, dependencies and config

**Files:**
- Create: `.claude/skills/sqlite/SKILL.md`; copy `skills/supabase` and `skills/supabase-postgres-best-practices` from `https://github.com/supabase/agent-skills` into `.claude/skills/`
- Modify: `CLAUDE.md` (Stack: "DB: SQLite via `node:sqlite` now (skill `sqlite`), Supabase later (skills `supabase`, `supabase-postgres-best-practices`) — always behind repository interfaces"), `.claude/skills/mvc-crud/SKILL.md` (Model row: "`models/sqlite/*` now, `models/supabase/*` later"), `.gitignore` (`api/data/`), `api/package.json`, `api/src/config.ts`

- [ ] **Step 1: Vendor Supabase skills** — clone `supabase/agent-skills` (depth 1) into a fresh temp dir, check that `skills/*` contain only markdown/reference files and the license is MIT, copy both skill folders, delete the temp dir. Add to the `CLAUDE.md` Skills section that they are vendored like the `pixijs*` skills.
- [ ] **Step 2: Write `sqlite` skill** (`name: sqlite`, description "Use when reading/writing the SQLite database in api — node:sqlite DatabaseSync, migrations via PRAGMA user_version, prepared statements, repositories, tests with :memory:"). Content: `DatabaseSync` from `node:sqlite`; always prepared statements with named params (`$id`), never string-built SQL; `PRAGMA foreign_keys = ON` and `journal_mode = WAL`; schema changes only as new numbered entries in the `MIGRATIONS` array in `db/sqlite.ts`; only `models/sqlite/*` may import `node:sqlite`; map snake_case rows → camelCase domain types in the repository; store timestamps as ISO strings; tests use `openDatabase(':memory:')`; keep SQL Postgres-compatible (TEXT ids, no SQLite-only types) to ease the Supabase move; dev/start scripts pass `--disable-warning=ExperimentalWarning`.
- [ ] **Step 3: Dependencies** — `npm install socket.io zod @sectorball/shared -w api`; `npm install -D socket.io-client -w api`. Add `--disable-warning=ExperimentalWarning` to `api` `dev`/`start` scripts. Add `databasePath: process.env.DATABASE_PATH ?? 'data/sectorball.db'` to `config.ts`.
- [ ] **Step 4: Verify** `npm run lint && npm run typecheck && npm test` → PASS; `node -e "import('@sectorball/shared').then(m => console.log(typeof m.createGame))"` run inside `api/` prints `function`.
- [ ] **Step 5: Commit** `chore(api): add sqlite and supabase skills, socket.io and shared deps`.

---

### Task 2: SQLite database and migrations

**Files:** Create `api/src/db/sqlite.ts`; Test `api/src/db/sqlite.test.ts`

**Interfaces:**
- Produces: `openDatabase(path: string): DatabaseSync` — creates the parent dir for file paths, enables `foreign_keys` + WAL (file DBs only), runs pending `MIGRATIONS` in a transaction, sets `PRAGMA user_version` to `MIGRATIONS.length`.
- Migration 1 (exact SQL):
  ```sql
  CREATE TABLE players (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
  CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    home_player_id TEXT NOT NULL REFERENCES players(id),
    away_player_id TEXT REFERENCES players(id),
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('open','live','finished','abandoned')),
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX matches_status_idx ON matches(status);
  ```

- [ ] **Step 1: Failing tests:** `openDatabase(':memory:')` creates both tables (`SELECT name FROM sqlite_master`), `PRAGMA user_version` = 1; opening twice on the same temp file (in `os.tmpdir()`) does not fail and keeps version 1.
- [ ] **Step 2: Run** `npm test -w api` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): add sqlite database with migrations`.

---

### Task 3: Players, guest sessions and auth

**Files:**
- Create: `api/src/errors.ts`, `models/player.ts`, `models/sqlite/playerRepository.ts`, `services/sessionService.ts`, `views/playerView.ts`, `middleware/auth.ts`, `middleware/validate.ts`, `controllers/sessionController.ts`, `routes/sessions.ts`
- Modify: `api/src/app.ts` (→ `createApp(deps: AppDeps)`, domain error mapping), `api/src/app.test.ts`
- Test: `api/src/services/sessionService.test.ts`, `api/src/routes/sessions.test.ts`

**Interfaces:**
- `errors.ts`: `class ValidationError`, `UnauthorizedError`, `NotFoundError`, `ConflictError` — each `extends Error` with a `readonly code: string` set from the constructor's first argument (no parameter properties — `erasableSyntaxOnly`).
- `models/player.ts`: `type Player = { readonly id: string; readonly nickname: string; readonly tokenHash: string; readonly createdAt: string }`; `interface PlayerRepository { create(p: Player): Promise<void>; findByTokenHash(hash: string): Promise<Player | undefined>; findById(id: string): Promise<Player | undefined> }`.
- `createSqlitePlayerRepository(db: DatabaseSync): PlayerRepository`.
- `createSessionService(deps: { players: PlayerRepository; now: () => Date }): { createGuest(nickname: string): Promise<{ token: string; player: PlayerInfo }>; authenticate(token: string): Promise<PlayerInfo | undefined> }` — nickname rule from Global Constraints (`ValidationError('invalidNickname')`).
- `toPlayerInfo(p: Player): PlayerInfo`.
- `requireAuth(sessions): RequestHandler` → `UnauthorizedError('unauthorized')` when the bearer token is missing/unknown; `getPlayer(res: Response): PlayerInfo` reads `res.locals.player`.
- `validateBody(schema: z.ZodType): RequestHandler` → `ValidationError` with the first zod issue message.
- `type AppDeps = { readonly sessions: SessionService; readonly matches: MatchService }` (`matches` is wired in Task 5; until then make it optional in a single place and remove the optionality in Task 5).
- Routes: `POST /api/sessions` body `{ nickname: string }` → `201 { token, player }`; `GET /api/sessions/me` (auth) → `200 PlayerInfo`.

- [ ] **Step 1: Failing tests:**
  - service (with `openDatabase(':memory:')`): `createGuest('  Zsolt ')` → `player.nickname === 'Zsolt'`, token length ≥ 43; DB row stores `token_hash !== token`; `authenticate(token)` → same player; `authenticate('nope')` → `undefined`; nickname `'a'` and 21 chars → `ValidationError`.
  - routes (supertest): `POST /api/sessions {nickname:'Zsolt'}` → 201 with `token`; `GET /api/sessions/me` with that bearer → 200 `{ nickname: 'Zsolt' }`; without/with bad token → 401 `{ error: 'unauthorized' }`; `{nickname: 5}` → 400.
  - existing `app.test.ts` health/404 tests still pass with `createApp(testDeps())`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): add guest sessions and bearer auth`.

---

### Task 4: Match records and match service

**Files:**
- Create: `models/match.ts`, `models/sqlite/matchRepository.ts`, `services/matchService.ts`
- Test: `api/src/models/sqlite/matchRepository.test.ts`, `api/src/services/matchService.test.ts`

**Interfaces:**
- `models/match.ts`: `type MatchRecord = { readonly id: string; readonly homePlayerId: string; readonly awayPlayerId: string | null; readonly homeScore: number; readonly awayScore: number; readonly status: MatchStatus; readonly createdAt: string; readonly finishedAt: string | null }`; `interface MatchRepository { create(m: MatchRecord): Promise<void>; markLive(id: string, awayPlayerId: string): Promise<void>; finish(id: string, score: Record<Team, number>, finishedAt: string): Promise<void>; abandonLive(): Promise<number> }`.
- `createSqliteMatchRepository(db): MatchRepository`.
- `createMatchService(deps: { matches: MatchRepository; now: () => number; random: () => number }): MatchService` with:
  - `listOpen(): MatchSummary[]` (newest first)
  - `create(player: PlayerInfo): Promise<MatchView>` — status `open`, `home = player`, `state: null`.
  - `join(matchId: string, player: PlayerInfo): Promise<MatchView>` — `NotFoundError('matchNotFound')`, `ConflictError('ownMatch')`, `ConflictError('matchFull')`; on success `away = player`, status `live`, `state = createGame({ matchId, firstKickoff: random() < 0.5 ? 'home' : 'away', now: now() })`, `markLive`.
  - `get(matchId): MatchView` (NotFound), `teamOf(matchId, playerId): Team | null`.
  - `setConnected(matchId, team, connected): MatchView`
  - `shoot(matchId, playerId, input: { seq: number; pieceId: PieceId; pull: Vec }): Promise<{ view: MatchView; replay: Replay }>`
  - `declareShot(matchId, playerId, seq): Promise<MatchView>`, `confirmKeeper(matchId, playerId, seq): Promise<MatchView>`, `moveKeeper(matchId, playerId, y): MatchView`
  - `tick(): Promise<MatchView[]>` — runs `advanceClock(state, now())` for live matches, returns the views whose state object changed.
  - All actions: non-participant → `ConflictError('notParticipant')`; match not live → `ConflictError('matchNotLive')`; `seq !== state.seq` → `ValidationError('staleState')`; engine `Result` error → `ValidationError(error)`. When a new state is `finished` → `matches.finish(...)` and status `finished`.
- Tests use the sqlite repos on `:memory:` with fake `now` (mutable counter) and `random: () => 0.1` (home kicks off).

- [ ] **Step 1: Failing tests:**
  - repo: `marks live matches abandoned on startup` — create 2 rows (`live`, `finished`), `abandonLive()` → returns 1, row statuses `abandoned` / `finished`.
  - service: `create` → appears in `listOpen`; `join` → `live`, state turn `home`, disappears from `listOpen`.
  - `rejects joining a full match` (third player → `ConflictError('matchFull')`) and `rejects joining your own match` (`ownMatch`).
  - `rejects actions with a stale seq`: two `shoot` calls with `seq 0` → second rejects `staleState`.
  - shoot by the player whose turn it isn't → `ValidationError('notYourTurn')`; outsider → `notParticipant`.
  - `tick` after `now += 30_000` returns one view with `lastDecision.kind === 'turnTimeout'`; with no time passed returns `[]`.
  - finishing: advance `now` past two halves via `tick` → status `finished`, repository row `finished` with scores.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): add match records and authoritative match service`.

---

### Task 5: Match REST endpoints

**Files:** Create `controllers/matchController.ts`, `routes/matches.ts`; Modify `app.ts`; Test `api/src/routes/matches.test.ts`

**Interfaces:**
- All require auth.
  - `GET /api/matches` → `200 { items: MatchSummary[] }` (open only)
  - `POST /api/matches` → `201 MatchView`, `Location: /api/matches/:id`
  - `POST /api/matches/:id/join` → `200 MatchView` (404 / 409 as in Task 4)
  - `GET /api/matches/:id` → `200 MatchView` (404)

- [ ] **Step 1: Failing tests** (supertest, two guests created via `POST /api/sessions`): list empty → create by A → list has 1 → B joins → 200 `status: 'live'`, `state.turn` set → list empty; A joins own → 409 `{ error: 'ownMatch' }`; C joins → 409 `matchFull`; unknown id → 404; no token → 401.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): add match lobby endpoints`.

---

### Task 6: Socket.IO gameplay and server wiring

**Files:**
- Create: `sockets/schemas.ts`, `sockets/matchSockets.ts`, `api/src/sockets/matchSockets.test.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Consumes: `ClientToServerEvents`, `ServerToClientEvents`, `MatchView`, `AckResult` from `@sectorball/shared`; `SessionService`, `MatchService`.
- Produces: `attachMatchSockets(io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { player: PlayerInfo }>, deps: { sessions: SessionService; matches: MatchService }): { broadcast(view: MatchView): void }`.
  - `io.use` auth: `handshake.auth.token` → `sessions.authenticate`, else `next(new Error('unauthorized'))`; store in `socket.data.player`.
  - Room per match: `match:${id}`.
  - `match:watch(matchId, ack)`: participant only; `socket.join(room)`; `setConnected(team, true)`; ack `{ ok: true, data: view }`; broadcast `match:updated` to the room.
  - `game:shoot` / `game:declareShot` / `game:confirmKeeper`: zod-validate payload (`pull: {x: number, y: number}`, `seq: int ≥ 0`, `pieceId` regex `^(home|away)-([1-5]|gk)$`), call the service, ack `{ ok: true, data: null }`, then emit `game:shot` (shoot) or `match:updated` (others) to the room. Any thrown domain error → ack `{ ok: false, error: err.code }`; zod failure → `invalidPayload`.
  - `game:moveKeeper`: validate, `matches.moveKeeper`, `match:updated` to the room; errors ignored (no ack).
  - `disconnect`: for every match room the socket was in, if no other socket of the same player remains in the room → `setConnected(team, false)` + broadcast.
- `index.ts`: `openDatabase(config.databasePath)` → repos → `await matchRepo.abandonLive()` → services (`now: Date.now`, `random: Math.random`) → `createApp` → `createServer` → `new Server(httpServer, { cors: { origin: config.clientOrigin } })` → `attachMatchSockets` → `setInterval(async () => (await matches.tick()).forEach(broadcast), 500)` (cleared on shutdown) → `listen`. Shutdown closes `io` and the DB.

- [ ] **Step 1: Failing integration tests** — start `createServer(createApp(deps))` + Socket.IO on port `0` in `beforeEach`, `socket.io-client` clients with `{ auth: { token }, transports: ['websocket'] }`; create guests and a live match via the services:
  - connecting without a token fails with `connect_error` message `unauthorized`.
  - both players `match:watch` → ack `ok`, view `connected.home && connected.away`.
  - home `game:shoot` with `seq 0` and a valid pull → ack ok; **both** clients receive `game:shot` with `replay.frames.length > 0` and `view.state.seq === 1`.
  - `rejects malformed payloads and non-participants`: `pull: 'x'` → `{ ok:false, error:'invalidPayload' }`; a third guest's `match:watch` → `{ ok:false, error:'notParticipant' }`.
  - `a reconnecting player receives the current view`: away disconnects → home gets `match:updated` with `connected.away === false`; away reconnects + `match:watch` → `state.seq === 1`, `connected.away === true`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `schemas.ts`, `matchSockets.ts`, `index.ts` wiring. **Step 4: Run** → PASS.
- [ ] **Step 5: Manual smoke** — `npm run dev:api`, `curl -X POST localhost:3000/api/sessions -H 'content-type: application/json' -d '{"nickname":"Zsolt"}'` → 201 JSON with a token; `api/data/sectorball.db` exists and is git-ignored.
- [ ] **Step 6: Commit** `feat(api): add socket.io gameplay and server wiring`.
