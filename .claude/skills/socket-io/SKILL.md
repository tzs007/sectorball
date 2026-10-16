---
name: socket-io
description: Use when implementing real-time client/server communication with Socket.IO — events, rooms, acknowledgements, reconnection, multiplayer state sync.
---

# Socket.IO

## Typed events (single source of truth)
Define all event contracts once in a shared module used by both client and server.
```ts
// shared/events.ts
export interface ServerToClientEvents {
  'game:state': (state: GameSnapshot) => void;
  'player:joined': (player: PlayerInfo) => void;
}
export interface ClientToServerEvents {
  'room:join': (roomId: string, ack: (res: AckResult<RoomInfo>) => void) => void;
  'player:input': (input: PlayerInput) => void;
}
export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };
```
```ts
// server
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, { cors: { origin: ALLOWED_ORIGINS } });
// client
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, { autoConnect: false });
```

## Rules
- Event names: `domain:action` (`room:join`, `player:input`, `game:state`). No string literals outside `events.ts`.
- **Server is authoritative.** Clients send inputs/intents; the server validates, simulates, and broadcasts state.
- **Validate every incoming payload** on the server (treat as `unknown`, use type guards or a schema lib).
  Never trust client-provided ids, scores or positions.
- Use **rooms** per game/match (`socket.join(roomId)`, `io.to(roomId).emit(...)`); namespaces only for truly
  separate concerns (e.g. `/admin`).
- Request/response → **acknowledgements** with timeout: `socket.timeout(5000).emit('room:join', id, cb)` or
  `await socket.timeout(5000).emitWithAck(...)`.
- High-frequency updates (positions): throttle to a fixed tick rate, send compact snapshots or deltas,
  consider `socket.volatile.emit` for droppable data. Interpolate on the client.
- Handle the lifecycle: `connect`, `disconnect` (with reason), `connect_error`. On reconnect, re-join rooms and
  resync state — don't assume the server remembers the client.
- Authenticate in a middleware (`io.use(...)`) via `socket.handshake.auth`, store user data in `socket.data`.
- **Cleanup:** remove listeners with `socket.off(event, handler)` when a UI component/page is destroyed;
  avoid registering the same listener twice.
- Server: attach Socket.IO to the same `http` server as Express (see `expressjs`). Socket handlers in
  `api/src/sockets/` call the same services as the HTTP controllers (see `mvc-crud`).
- Keep socket code in a transport/service layer; game logic and rendering/UI code must not import `socket.io-client`
  directly (see `solid`, `atomic-design`).

## Avoid
- Emitting the whole game state on every small change without throttling.
- Using `io.emit` (broadcast to everyone) when a room-scoped emit is intended.
- `any`-typed payloads.

Related: [[solid]], [[typescript]], [[dry]].
