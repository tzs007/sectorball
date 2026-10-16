---
name: expressjs
description: Use when building or changing the Express.js HTTP server — app setup, routers, middleware, request validation, error handling, CORS, serving the SPA, and sharing the HTTP server with Socket.IO.
---

# Express.js (v5)

## Rules
- Express **5** (`express@^5`): async handlers are supported — a rejected promise goes to the error handler,
  no `try/catch` + `next(err)` boilerplate needed.
- Build the app in a factory (`createApp(deps)`) in `app.ts`; `index.ts` creates the HTTP server and listens.
  This keeps the app testable (e.g. with `supertest`) and lets Socket.IO share the same server.
- One `Router` per resource in `routes/`, mounted under a prefix: `app.use('/api/rooms', roomsRouter)`.
- Follow the **`mvc-crud`** skill: routes → controllers → services → models, DTO views, REST/CRUD verbs and
  status codes. Routes only wire paths to controllers; controllers stay thin.
- **Validate every input** (`req.body`, `req.params`, `req.query`) — treat as `unknown`, use a schema library
  (e.g. `zod`) or type guards. Respond `400` with a clear message on invalid input.
- Map domain errors (`NotFoundError` → `404`, `ConflictError` → `409`, `ValidationError` → `400`) in the
  central error handler.
- Middleware order: security/CORS → body parsing (`express.json({ limit: '100kb' })`) → routes →
  404 handler → error handler (the 4-argument one, registered **last**).
- Security basics: `helmet()`, CORS restricted to `config.clientOrigin`, `app.disable('x-powered-by')`.
  Never leak stack traces in production responses.
- In production, serve the built SPA (`dist/`) with `express.static` and fall back to `index.html` for
  client-side routes — after the `/api` routes.

## Example
```ts
// api/src/app.ts
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRoomsRouter } from './routes/rooms.ts';
import type { RoomService } from './services/roomService.ts';
import { config } from './config.ts';

export type AppDeps = { readonly rooms: RoomService };

export const createApp = ({ rooms }: AppDeps) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/rooms', createRoomsRouter(rooms));

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: config.isProduction ? 'Internal server error' : String(err) });
  };
  app.use(onError);
  return app;
};
```
```ts
// api/src/index.ts — Express and Socket.IO share one HTTP server
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = createApp({ rooms });
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.clientOrigin } });
httpServer.listen(config.port, () => console.info(`listening on :${config.port}`));
```

## Dev setup with the Vite client
Proxy API and socket traffic in `vite.config.ts` so the client uses relative URLs:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/socket.io': { target: 'http://localhost:3000', ws: true },
  },
},
```

## Avoid
- Express 4 patterns (`app.del`, `req.param()`, wrapping async handlers in a helper).
- `app.listen()` when Socket.IO is needed — create the `http` server explicitly.
- Business logic, DB access or socket emits directly in route handlers (go through services).

Related: [[nodejs]], [[mvc-crud]], [[socket-io]], [[solid]], [[typescript]].
