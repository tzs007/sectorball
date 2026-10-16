---
name: nodejs
description: Use when writing or running server-side Node.js code in this project — runtime setup, ESM, TypeScript execution, config/env, async error handling, graceful shutdown, server folder layout.
---

# Node.js (server runtime)

## Runtime
- Node.js **22 LTS or newer** (≥22.18). Pin it in `package.json` → `"engines": { "node": ">=22.18" }` and `.nvmrc`.
- ES modules only (`"type": "module"`), `import`/`export`, no `require`.
- Use the `node:` prefix for built-ins: `import { createServer } from 'node:http'`.
- TypeScript runs directly via Node's built-in type stripping: `node --watch src/index.ts` in dev (inside the `api` workspace).
  This requires *erasable* syntax only → set `"erasableSyntaxOnly": true` in the server tsconfig
  (no `enum`, no `namespace`, no constructor parameter properties). Use `import type` for type-only imports.
- Type-check separately with `tsc --noEmit` (Node does not type-check).

## Layout
```
api/                  # @sectorball/api workspace (see `npm-workspaces`)
  src/
    index.ts          # entry: create app + http server + socket.io, listen, shutdown
    app.ts            # express app factory (see `expressjs`)
    config.ts         # reads + validates env once, exports a typed config object
    routes/           # express routers: verb + path → controller (see `mvc-crud`)
    controllers/      # HTTP controllers: req → service → DTO
    sockets/          # socket.io handlers per domain (see `socket-io`)
    services/         # domain/game logic, no express/socket imports
    models/           # domain types + repositories
    views/            # DTO mappers (JSON response shapes)
    middleware/
  .env.example
  tsconfig.json       # extends ../tsconfig.base.json
shared/               # (future workspace) types + event contracts shared with game/
```
Game logic in `services/` must not depend on Express or Socket.IO (see `solid`).

## Configuration
- Read `process.env` **only** in `config.ts`; validate at startup and fail fast with a clear message.
- Local env via `node --env-file=.env` (built-in, no `dotenv` needed). Commit `.env.example`, never `.env`.

```ts
// api/src/config.ts
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigin: required('CLIENT_ORIGIN'),
  isProduction: process.env.NODE_ENV === 'production',
} as const;
```

## Async & errors
- `async`/`await` everywhere; never leave a promise floating (await it or handle `.catch`).
- Use `node:events` `once`, `node:timers/promises` `setTimeout` instead of hand-rolled promise wrappers.
- Throw `Error` subclasses with a clear message; don't throw strings.
- Log `unhandledRejection` / `uncaughtException`, then exit — don't keep running in an unknown state.

## Graceful shutdown
```ts
const shutdown = (signal: string): void => {
  console.info(`${signal} received, shutting down`);
  io.close();                       // closes socket.io and the underlying http server
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
```

## Avoid
- Sync I/O (`fs.readFileSync` etc.) in request/socket handlers — fine only at startup.
- CPU-heavy loops blocking the event loop; keep the game tick light or move work to `worker_threads`.
- Global mutable singletons scattered across modules — create state in `index.ts` and inject it.

Related: [[expressjs]], [[mvc-crud]], [[socket-io]], [[typescript]], [[solid]].
