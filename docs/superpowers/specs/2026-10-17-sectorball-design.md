# Sectorball — design spec (v1)

Turn-based, browser-based table football ("gombfoci") for 2 players on 2 browsers. PixiJS v8 rendering,
React 19 UI, Express 5 + Socket.IO backend, SQLite now (Supabase later).

## Decisions (agreed with the user, 2026-10-17)
| Topic | Decision |
|---|---|
| Login | Nickname + guest session token (stored in `localStorage`). Real accounts later via Supabase Auth. |
| Turn rule | **Classic alternating**: after every shot the other team moves, regardless of who has the ball. Exceptions are restarts (below). A successful pass is only reported as an event. |
| Match time | 2 × 10 minutes **wall-clock** per half, plus a **30 s limit per shot** and **15 s** for the goalkeeper setup. |
| Shot input | **Slingshot**: the player presses on one of their buttons and drags a vector out of it. The drag length is the power, the button moves in the **opposite** direction of the drag. |
| DB | `node:sqlite` (built-in) behind repository interfaces, so a Supabase implementation can replace it. |
| Authority | The **server** simulates every shot (deterministic physics in a shared package) and is the only source of truth. Clients send intents and animate the replay frames they receive. |

## Teams & pitch (5 v 5)
- Each team: 5 outfield buttons (`home-1`…`home-5`, `away-1`…`away-5`) + 1 goalkeeper (`home-gk`, `away-gk`),
  a rectangular block that only slides along its own goal line.
- Pitch coordinates (units): field 1000 × 640, origin top-left, plus a 40-unit margin drawn around it.
  - Goals on the left (x = 0) and right (x = 1000) lines, mouth y 240–400 (width 160), depth 30, posts radius 4.
  - Penalty areas: 150 deep, 360 wide (y 140–500). Penalty spot 110 from the goal line.
  - Halfway line x = 500, centre circle radius 90, centre spot (500, 320).
- Sizes: button radius 22, ball radius 10, keeper 14 × 56 (centre 9 units inside the goal line, centre y clamped to 240–400).
- Half 1: `home` defends the left goal. Half 2: sides swap.

## Physics (deterministic, fixed step)
- Step 1/120 s; constant deceleration (buttons 900 u/s², ball 1000 u/s²); restitution 0.9 between circles,
  0.7 on the keeper, 0.6 on posts; masses button 1, ball 0.5; keeper and posts are static.
- Shot speed = `min(|pull|, 160) / 160 × 1100` u/s, direction `-pull`. Pulls shorter than 10 are rejected.
- Simulation ends when every body is slower than 2 u/s or after 2400 steps. Replay frames sampled every 2 steps (60 fps).
- The ball leaves play when its centre is more than one radius beyond a line; between the posts that is a goal.
  Buttons that end outside the field are moved onto the nearest line; overlapping pieces are pushed apart.

## Rules → referee decisions (in priority order after each shot)
1. **Foul**: the shot button touches an opponent outfield button before it has touched the ball.
   The victim gets a **free kick** at the contact point (opponents pushed to ≥ 60 units). If the contact point is inside
   the fouling team's own penalty area → **penalty** (ball on the spot, every button except the victim's nearest one
   moved out of the area, keeper stays; the defender sets the keeper first, then only that kicker may shoot).
2. **Goal**: ball crosses the goal line between the posts.
   Valid if it is an own goal, a penalty, or a **declared shot** ("Kapu!"). Otherwise it is disallowed → goal kick.
   After a valid goal the conceding team kicks off.
3. **Ball out**: touchline → throw-in for the opponent of the last toucher, at the exit point. Goal line →
   corner if the defending team touched it last, otherwise goal kick (ball 60 units in front of the goal centre).
4. **Kickoff**: ball on the centre spot, kicking team may have one button inside the circle. If the ball never left the
   centre circle the kickoff is retaken by the same team.
5. Otherwise play continues; the other team moves.
- Restarts (free kick, penalty, throw-in, corner, goal kick, kickoff) give the **next turn to the awarded team**.
- **Declaring a shot ("Kapu!")**: only on your turn, only when the ball is in the opponent's half and not during a penalty.
  The defender then gets up to 15 s to slide the keeper and confirm, then the attacker shoots. The keeper is fixed during the shot.
- **Timeouts**: no shot within 30 s → the turn (and any pending restart) passes to the other team.
- **Clock**: when a half's 10 minutes are up the half ends immediately (a pending penalty is still taken).
  Half time → swap sides, the team that did not kick off first starts. Full time → most goals wins, otherwise draw.

## Backend
- REST: guest sessions, open-match lobby, create/join match (`mvc-crud` layering).
- Socket.IO (auth via session token): watching a match, shoot / declare shot / move & confirm keeper, presence.
  Server broadcasts the new match view and, for shots, the replay frames.
- SQLite: players (token stored as SHA-256 hash) and match records (`open` → `live` → `finished` / `abandoned`).
  Live game state is in memory; live matches are marked `abandoned` on server start.

## Frontend
- `Game.tsx` organism: reusable playing field (PixiJS canvas + HUD) driven only by props/callbacks;
  pages wire it to the socket. Internals split into atoms/molecules (`atomic-design`).
- Pages: login (nickname) → lobby (open matches, create, join) → match.
