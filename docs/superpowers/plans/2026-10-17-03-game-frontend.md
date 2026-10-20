# Game Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The playable browser client: nickname login, lobby, and a reusable `Game.tsx` organism (PixiJS pitch + HUD) with slingshot shooting, goalkeeper setup and replay animation, wired to the backend over Socket.IO.

**Architecture:** `Game.tsx` is a presentational organism: it receives the `GameState`, the viewer's team, an optional `Replay` and callbacks — no socket/fetch inside, so it is reusable (e.g. for a future local/AI mode). Pages own the data: `useSession` (REST), `useLobby` (REST), `useMatch` (Socket.IO). Pure logic (viewport fit, aim geometry, replay sampling, clock formatting) lives in `utils/` and is unit-tested; PixiJS components stay thin (PixiJS does not render in jsdom). Depends on plans 01 and 02.

**Tech Stack:** React 19, `@pixi/react` 8 + `pixi.js` 8, `socket.io-client` 4.8, Vite 8, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-17-sectorball-design.md`

## Global Constraints
- Prerequisites: plans 01 and 02 merged; all game numbers come from `@sectorball/shared` constants, colours from `game/src/constants/theme.ts`.
- World coordinates = pitch units: the field `FIELD.width × FIELD.height` plus `FIELD.margin` on every side, drawn in one `pixiContainer` scaled to fit the canvas (aspect preserved, centred).
- **Slingshot input**: `pointerdown` on an own, shootable button starts aiming; `pull = pointer − button` (world units, clamped to `SHOT.maxPull` for display); release with `|pull| ≥ SHOT.minPull` calls `onShoot(pieceId, pull)`; shorter releases cancel. The button visibly would move toward `−pull`.
- **Placeholder graphics only** (to be replaced by pixel-art sprites later): flat single-colour shapes from `THEME`
  (circles for buttons/ball, rectangles for keepers, flat pitch colour + white lines, no stripes, gradients, shadows or
  canvas text). Each visual entity is drawn by exactly **one** PixiJS atom (`ButtonPiece`, `KeeperPiece`, `Ball`, `Pitch`)
  whose props are entity data only (`piece`/`pos`, flags like `selectable`), centred on the entity position and sized
  from `PIECE` constants — so a sprite version can replace the atom's body (`pixiSprite`, anchor 0.5) without touching
  any caller. Hit-testing must not depend on the drawn shape: give `ButtonPiece` an explicit
  `hitArea = new Circle(0, 0, PIECE.buttonRadius)`. Selection/turn feedback is a separate overlay (ring), not baked into the piece colour.
- The client never decides rules: it only uses `canShoot` / `canDeclareShot` from `@sectorball/shared` to enable UI.
- Session persisted in `localStorage` key `sectorball.session` as `{ token, player }`.
- UI copy (Hungarian): buttons `Belépés`, `Új meccs`, `Csatlakozás`, `Kapu!`, `Kapus kész`; turn text `Te jössz` / `Az ellenfél jön`; keeper setup text `Állítsd be a kapust!`; decision toasts: `GÓL!`, `Öngól`, `Nem érvényes gól – kirúgás`, `Szabálytalanság – szabadrúgás`, `Tizenegyes!`, `Bedobás`, `Szöglet`, `Kirúgás`, `Középkezdés újra`, `Sikeres passz`, `Lejárt az idő`, `Félidő`, `Vége`.
- Skills to follow: `react`, `atomic-design`, `pixijs` (+ `pixijs-events`, `pixijs-scene-graphics`), `socket-io`, `vitest-tdd`, `kiss`.

## Review Focus
1. Window resize / small screens — pointer → world mapping must stay correct after resize. → Task 2 test `toWorld inverts fitToView at any scale`.
2. Releasing the drag outside the canvas (`pointerupoutside`) or a second pointer — must still end (or cancel) the aim, never leave a stuck arrow. → Task 4 test `pointer up outside ends the aim`.
3. A new `game:shot` arriving while a replay is still animating (fast opponent / timeout) — replays must queue, the shown state must not jump. → Task 6 test `queues replays that arrive during playback`.
4. Rapid keeper dragging flooding the socket — emissions throttled to ≤ 1 per 100 ms. → Task 2 test `throttle emits at most once per interval and keeps the last value`.
5. Stale or expired session token in `localStorage` (DB reset) — must fall back to the login screen, not a broken lobby. → Task 3 test `clears an invalid stored session`.

---

## File Structure (game/src)
```
constants/theme.ts                 # colours (replaces constants/game.ts)
services/apiClient.ts              # REST client
services/gameSocket.ts             # typed socket.io-client factory
hooks/useSession.ts  hooks/useLobby.ts  hooks/useMatch.ts  hooks/useNow.ts
utils/viewport.ts  utils/aim.ts  utils/replay.ts  utils/format.ts  utils/throttle.ts  utils/decisionText.ts
components/
  atoms/        Button.tsx  TextInput.tsx                         (DOM)
                PitchLines.tsx  ButtonPiece.tsx  Ball.tsx  KeeperPiece.tsx  AimArrow.tsx   (PixiJS)
  molecules/    LoginForm.tsx  MatchListItem.tsx  Scoreboard.tsx  ActionBar.tsx  DecisionToast.tsx  (DOM)
                Pitch.tsx                                          (PixiJS: lines + goals)
  organisms/    Lobby.tsx  Game.tsx  GameScene.tsx                 (GameScene = PixiJS scene inside <Application>)
  templates/    MainLayout.tsx (exists)
pages/          LoginPage.tsx  LobbyPage.tsx  MatchPage.tsx
App.tsx                                                           # session → lobby → match
```
Delete: `components/organisms/GameCanvas.tsx`, `constants/game.ts`, `pages/HomePage.tsx` (replaced).

---

### Task 1: Dependencies, theme, API client and socket factory

**Files:**
- Create: `constants/theme.ts`, `services/apiClient.ts`, `services/gameSocket.ts`
- Modify: `game/package.json`, `game/vite.config.ts` (proxy `'/socket.io': { target: 'http://localhost:3000', ws: true }`)
- Test: `game/src/services/apiClient.test.ts`

**Interfaces:**
- `THEME = { home: '#e53935', away: '#1e88e5', pitch: '#2e7d32', lines: '#ffffff', ball: '#fafafa', aim: '#ffeb3b', highlight: '#ffd54f' } as const`.
- `class ApiError extends Error { readonly status: number; readonly code: string }` (assign in constructor body).
- `createApiClient(fetchFn: typeof fetch = fetch)` returning:
  `createSession(nickname): Promise<{ token: string; player: PlayerInfo }>`, `me(token): Promise<PlayerInfo>`, `listMatches(token): Promise<MatchSummary[]>`, `createMatch(token): Promise<MatchView>`, `joinMatch(token, id): Promise<MatchView>` — relative URLs (`/api/...`), JSON, `Authorization: Bearer`; non-2xx → `ApiError(status, body.error)`.
- `type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>`; `connectGameSocket(token: string): GameSocket` → `io({ auth: { token } })`.

- [ ] **Step 1:** `npm install socket.io-client @sectorball/shared -w game`.
- [ ] **Step 2: Failing tests** with a `vi.fn()` fetch: `createSession('Zsolt')` POSTs `/api/sessions` with JSON body and returns the parsed body; `listMatches('t')` sends `Authorization: Bearer t` and returns `items`; a `409 { error: 'matchFull' }` rejects with `ApiError` `{ status: 409, code: 'matchFull' }`.
- [ ] **Step 3: Run** `npm test -w game` → FAIL. **Step 4: Implement.** **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(game): add api client, socket factory and theme`.

---

### Task 2: Pure client utilities

**Files:** Create `utils/viewport.ts`, `utils/aim.ts`, `utils/replay.ts`, `utils/format.ts`, `utils/throttle.ts`, `utils/decisionText.ts`; Tests next to each.

**Interfaces:**
- `WORLD = { width: FIELD.width + 2 * FIELD.margin, height: FIELD.height + 2 * FIELD.margin }`.
- `fitToView(viewWidth: number, viewHeight: number): { scale: number; x: number; y: number }` — contain-fit of `WORLD`, centred; the container is placed at `(x, y)` with `scale`, and pitch origin is offset by `FIELD.margin` inside it.
- `toWorld(screen: Vec, fit): Vec` — inverse mapping to **pitch** coordinates (subtracts margin).
- `aimGeometry(from: Vec, pull: Vec): { band: Vec; direction: Vec; power: number }` — `band = from + clampLength(pull, SHOT.maxPull)` (rubber band end), `direction = from − clampLength(pull, maxPull) × 1.5` (arrow tip, toward the shot), `power = min(|pull|, maxPull) / maxPull`.
- `frameIndexAt(replay: Replay, elapsedMs: number): number` (clamped to last) and `isReplayDone(replay, elapsedMs): boolean`.
- `formatClock(ms: number): string` → `mm:ss`, negative → `00:00`; `halfRemainingMs(state, now)`; `turnRemainingMs(state, now)` (uses `keeperSetupLimitMs` in keeper setup).
- `throttle<T>(fn: (v: T) => void, intervalMs: number, now = () => Date.now()): { call(v: T): void; flush(): void; cancel(): void }` — leading call, then at most one per interval, trailing call with the last value via `setTimeout`.
- `decisionText(d: Decision, myTeam: Team): string | null` — maps to the Global Constraints copy (`play` with `pass: false` → `null`; `foul` with `penalty` → `Tizenegyes!`).

- [ ] **Step 1: Failing tests:**
  - `toWorld inverts fitToView at any scale`: for views `800×600`, `1920×1080`, `375×667`: `toWorld(screenOf(vec(500,320)))` ≈ `(500,320)` (±0.01), and the fitted world fits inside the view.
  - `aimGeometry(vec(100,100), vec(-80,0))` → band `(20,100)`, direction `(220,100)`, power `0.5`; pull longer than 160 is clamped.
  - `frameIndexAt` with 10 frames @ 1000/60 ms: `0 → 0`, `50 → 3`, `10_000 → 9`; `isReplayDone` true at ≥ 10 frames' time.
  - `formatClock(600_000) === '10:00'`, `formatClock(61_500) === '01:01'`, `formatClock(-5) === '00:00'`.
  - `throttle emits at most once per interval and keeps the last value` (fake timers: calls at 0, 10, 20 ms with 1,2,3 → fn called with 1 then 3 at 100 ms).
  - `decisionText` table for every `Decision.kind`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(game): add viewport, aim, replay, clock and throttle utilities`.

---

### Task 3: Session, login page and DOM atoms

**Files:**
- Create: `atoms/Button.tsx`, `atoms/TextInput.tsx`, `molecules/LoginForm.tsx`, `hooks/useSession.ts`, `pages/LoginPage.tsx`
- Test: `molecules/LoginForm.test.tsx`, `hooks/useSession.test.tsx`

**Interfaces:**
- `Button` props `{ children; onClick?; disabled?; variant?: 'primary' | 'secondary'; type?: 'button' | 'submit' }` (native `<button>`); `TextInput` props `{ label: string; value: string; onChange(value: string): void; maxLength?: number }` (label wraps input → accessible name).
- `LoginForm` props `{ onSubmit(nickname: string): void; busy?: boolean; error?: string | null }` — label `Becenév`, submit `Belépés`, disabled while trimmed length < 2 or `busy`.
- `useSession(api = createApiClient()): { session: Session | null; status: 'checking' | 'ready'; login(nickname): Promise<void>; logout(): void; error: string | null }` with `type Session = { token: string; player: PlayerInfo }`; on mount validates a stored session with `api.me` and clears it on `ApiError` 401.
- `LoginPage` props `{ onLogin(nickname): void; busy; error }` → `MainLayout` + `LoginForm`.

- [ ] **Step 1: Failing tests:** LoginForm — typing `Zs` enables `Belépés`, submit calls `onSubmit('Zs')`, `' a '` keeps it disabled, `error` text is shown. useSession (`renderHook`, fake api) — `login` stores `{token, player}` in `localStorage`; `clears an invalid stored session` (stored token + `me` rejecting 401 → `session === null`, storage key removed).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(game): add guest login`.

---

### Task 4: PixiJS atoms and the pitch

**Files:** Create `atoms/PitchLines.tsx`, `atoms/ButtonPiece.tsx`, `atoms/KeeperPiece.tsx`, `atoms/AimArrow.tsx`, `molecules/Pitch.tsx`, `hooks/useAimDrag.ts`; Modify `atoms/Ball.tsx` (props `{ pos: Vec }`, colour `THEME.ball`, radius `PIECE.ballRadius`); Test `hooks/useAimDrag.test.ts`

**Interfaces:**
- All PixiJS components render `pixiGraphics` with a `useCallback` `draw` (v8 shape-then-fill, `g.clear()` first); classes registered once in `Game.tsx` via `extend({ Container, Graphics })`.
- `PitchLines` — field rectangle, halfway line, centre circle + spot, both penalty areas and spots, using shared constants (`stroke({ width: 2, color: THEME.lines })`).
- `Pitch` — flat `THEME.pitch` background over the whole world + `PitchLines` + two goals as flat rectangles (mouth `GOAL.mouthTop…mouthBottom`, depth `GOAL.depth`, outside the line).
- `ButtonPiece` props `{ piece: Piece; selectable: boolean; selected: boolean; onAimStart?(pieceId: PieceId, e: FederatedPointerEvent): void }` — team-coloured circle radius `PIECE.buttonRadius`, highlight ring when `selectable` (`THEME.highlight`), `eventMode = selectable ? 'static' : 'none'`, cursor `grab`.
- `KeeperPiece` props `{ piece: Piece; draggable: boolean; onDragStart?(e): void }` — rectangle `keeperWidth × keeperHeight` centred on `pos`.
- `AimArrow` props `{ from: Vec; pull: Vec }` — uses `aimGeometry`: thin band line `from → band`, thick arrow `from → direction` with a triangular head, alpha/width scaled by `power`, colour `THEME.aim`.
- `useAimDrag(onShoot: (id: PieceId, pull: Vec) => void): { aim: { pieceId: PieceId; from: Vec; pull: Vec } | null; start(id, from: Vec, pointer: Vec): void; move(pointer: Vec): void; end(): void; cancel(): void }` — pure React state (pointer coords already in pitch units); `end` calls `onShoot` only when `|pull| ≥ SHOT.minPull`.

- [ ] **Step 1: Failing tests** (`renderHook`): start at `(100,100)` + move to `(40,100)` → `aim.pull === (-60,0)`; `end()` calls `onShoot('home-1', (-60,0))` and clears `aim`; move to `(105,100)` then `end()` → no call; `pointer up outside ends the aim` = `cancel()` clears without calling.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** hook + components. **Step 4: Run** → PASS; `npm run typecheck -w game && npm run lint -w game` clean.
- [ ] **Step 5: Commit** `feat(game): add pitch and piece components with slingshot aiming`.

---

### Task 5: HUD molecules

**Files:** Create `molecules/Scoreboard.tsx`, `molecules/ActionBar.tsx`, `molecules/DecisionToast.tsx`, `hooks/useNow.ts`; Tests `molecules/Scoreboard.test.tsx`, `molecules/ActionBar.test.tsx`

**Interfaces:**
- `useNow(intervalMs = 250): number`.
- `Scoreboard` props `{ state: GameState; players: Record<Team, PlayerInfo | null>; myTeam: Team; now: number }` — nicknames with team colours, `score.home – score.away`, `1. félidő` / `2. félidő`, half clock `formatClock(halfRemainingMs)`, turn text + `formatClock(turnRemainingMs)`; keeper setup for me → `Állítsd be a kapust!`; finished → `Vége` + winner nickname or `Döntetlen`.
- `ActionBar` props `{ canDeclareShot: boolean; keeperSetup: boolean; onDeclareShot(): void; onConfirmKeeper(): void }` — `Kapu!` (disabled unless `canDeclareShot`), `Kapus kész` shown only when `keeperSetup`.
- `DecisionToast` props `{ text: string | null }` — `role="status"`, hidden when `null`.

- [ ] **Step 1: Failing tests:** Scoreboard shows `2 – 1`, `09:59` at `now = halfStartedAt + 1_000`, `Te jössz` when `turn === myTeam`, `Az ellenfél jön` otherwise, `Vége`/winner when finished. ActionBar: `Kapu!` disabled/enabled by prop and calls `onDeclareShot`; `Kapus kész` only in keeper setup and calls `onConfirmKeeper`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(game): add scoreboard, action bar and decision toast`.

---

### Task 6: `Game.tsx` organism with scene, input and replay

**Files:** Create `organisms/Game.tsx`, `organisms/GameScene.tsx`, `hooks/useReplayQueue.ts`; Tests `organisms/Game.test.tsx`, `hooks/useReplayQueue.test.ts`

**Interfaces:**
- `GameProps = { state: GameState; myTeam: Team; players: Record<Team, PlayerInfo | null>; replay: Replay | null; onShoot(pieceId: PieceId, pull: Vec): void; onDeclareShot(): void; onMoveKeeper(y: number): void; onConfirmKeeper(): void; onReplayEnd(): void }`.
- `Game` — layout: `Scoreboard` on top, canvas area (`<div ref>` + `<Application resizeTo={ref} background={THEME.pitch} antialias>` containing `GameScene`), `ActionBar` and `DecisionToast` (`decisionText(state.lastDecision, myTeam)`) below. Calls `extend({ Container, Graphics })` at module level.
- `GameScene` (inside `<Application>`) props = `GameProps` minus HUD callbacks + `{ onShoot; onMoveKeeper }`:
  - Root `pixiContainer` positioned/scaled by `fitToView(app.screen)` (recomputed on resize via `app.renderer.on('resize')`), inner container offset by `FIELD.margin`.
  - Renders `Pitch`, keepers, buttons (`selectable = !replay && canShoot(state, myTeam, id)`), `Ball`, and `AimArrow` while aiming.
  - Input: `ButtonPiece.onAimStart` → `useAimDrag.start`; stage `globalpointermove` → `move(toWorld(e.global, fit))`; `pointerup` → `end`; `pointerupoutside` → `cancel`. Keeper drag (only when `state.phase === 'keeperSetup' && state.turn === myTeam`): `globalpointermove` → `onMoveKeeper(toWorld(...).y)` through `throttle(…, 100)`; the local keeper preview uses `clampKeeperY`.
  - Replay: while `replay` is set, positions come from `replay.frames[frameIndexAt(replay, elapsed)]` advanced in `useTick`; when `isReplayDone` → `onReplayEnd()`; input disabled during replay.
- `useReplayQueue(): { current: { replay: Replay; view: MatchView } | null; push(item): void; finishCurrent(): void }` — FIFO.

- [ ] **Step 1: Failing tests:**
  - `useReplayQueue`: `queues replays that arrive during playback` — push A, push B → `current === A`; `finishCurrent()` → `B`; again → `null`.
  - `Game.test.tsx` with `vi.mock('@pixi/react', () => ({ Application: () => null, extend: () => undefined, useApplication: …, useTick: () => undefined }))`: renders Scoreboard + ActionBar from props; `Kapu!` enabled exactly when `canDeclareShot(state, myTeam)`; clicking calls `onDeclareShot`; `lastDecision: { kind: 'goal', scorer: 'home', ownGoal: false }` shows `GÓL!`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `useReplayQueue`, `GameScene`, `Game`. **Step 4: Run** → PASS; typecheck + lint clean.
- [ ] **Step 5: Commit** `feat(game): add reusable Game organism with pixi scene`.

---

### Task 7: Lobby, match page and app flow

**Files:**
- Create: `molecules/MatchListItem.tsx`, `organisms/Lobby.tsx`, `hooks/useLobby.ts`, `hooks/useMatch.ts`, `pages/LobbyPage.tsx`, `pages/MatchPage.tsx`
- Modify: `App.tsx`, `styles/global.css`, `.claude/skills/react/SKILL.md` (structure: pages/hooks/services list as implemented)
- Delete: `organisms/GameCanvas.tsx`, `constants/game.ts`, `pages/HomePage.tsx`
- Test: `organisms/Lobby.test.tsx`, `hooks/useMatch.test.ts`

**Interfaces:**
- `MatchListItem` props `{ match: MatchSummary; onJoin(id): void }` → host nickname + `Csatlakozás`.
- `Lobby` props `{ matches: MatchSummary[]; onCreate(): void; onJoin(id): void; busy: boolean; error: string | null }` → `Új meccs` + list, empty text `Nincs nyitott meccs`.
- `useLobby(token, api)` → `{ matches, create(): Promise<MatchView>, join(id): Promise<MatchView>, error }`, refreshes on mount and every 3 s.
- `useMatch(token, matchId, socketFactory = connectGameSocket)` → `{ view: MatchView | null; myTeam: Team | null; replayItem; shoot(id, pull); declareShot(); moveKeeper(y); confirmKeeper(); finishReplay(); error: string | null }`:
  - on `connect` (also every reconnect) emits `match:watch` and stores the view;
  - `match:updated` → replace view only when no replay is playing (otherwise keep the latest as pending and apply after the queue drains);
  - `game:shot` → `useReplayQueue.push`;
  - actions send the current `view.state.seq`; ack errors go to `error`; disconnect on unmount.
- `MatchPage` props `{ session; matchId; onLeave(): void }` — waits for the opponent (`Várakozás az ellenfélre…` while `state === null`), then renders `Game` with the displayed state (`replayItem ? previous state : view.state`) and `Kilépés` back to the lobby.
- `App` — `useSession`: `checking` → nothing; no session → `LoginPage`; session + no match → `LobbyPage` (`onEnterMatch(id)`); match → `MatchPage`.

- [ ] **Step 1: Failing tests:** Lobby — empty text, list renders nicknames, `Csatlakozás` calls `onJoin(id)`, `Új meccs` calls `onCreate`. useMatch with a fake socket (`EventEmitter`-based stub implementing `on/off/emit/disconnect`): emits `match:watch` on `connect`; `game:shot` while a replay plays is queued; `shoot` sends `{ matchId, seq: view.state.seq, pieceId, pull }`; an ack `{ ok:false, error:'notYourTurn' }` sets `error`; re-`connect` emits `match:watch` again.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, delete the replaced files. **Step 4: Run** root `npm run lint && npm run typecheck && npm test && npm run build` → PASS.
- [ ] **Step 5: Manual two-browser verification** — `npm run dev`; browser A (normal window) logs in as `A`, `Új meccs`; browser B (private window) logs in as `B`, joins. Check: both see the pitch with 5+1 pieces per side and the same kickoff team; only the player on turn sees highlighted buttons; dragging out of a button draws the band and an arrow in the opposite direction, release shoots the button that way and both browsers animate the same replay; turns alternate; `Kapu!` only enabled in the opponent half, the defender can slide the keeper and confirm; reload of B restores the match; clock counts down from `10:00`.
- [ ] **Step 6: Commit** `feat(game): add lobby, match page and app flow`.
