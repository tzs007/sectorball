import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { openDatabase } from './db/sqlite.ts';
import { createSqliteMatchRepository } from './models/sqlite/matchRepository.ts';
import { createSqlitePlayerRepository } from './models/sqlite/playerRepository.ts';
import { createMatchService } from './services/matchService.ts';
import { createSessionService } from './services/sessionService.ts';
import { attachMatchSockets, type MatchServer } from './sockets/matchSockets.ts';

const TICK_MS = 500;

const db = openDatabase(config.databasePath);
const players = createSqlitePlayerRepository(db);
const sessions = createSessionService({ players, now: () => new Date() });

const matchRepository = createSqliteMatchRepository(db);
await matchRepository.abandonLive();
const matches = createMatchService({ matches: matchRepository, now: Date.now, random: Math.random });

const httpServer = createServer(createApp({ sessions, matches }));
const io: MatchServer = new Server(httpServer, { cors: { origin: config.clientOrigin } });
const sockets = attachMatchSockets(io, { sessions, matches });

// applies clock timeouts (turn and half deadlines) and pushes the changed matches to their players
const ticker = setInterval(() => {
  matches
    .tick()
    .then((views) => {
      for (const view of views) sockets.broadcast(view);
    })
    .catch((error: unknown) => {
      console.error('match tick failed', error);
    });
}, TICK_MS);

httpServer.listen(config.port, () => {
  console.info(`api listening on http://localhost:${config.port}`);
});

const shutdown = (signal: string): void => {
  console.info(`${signal} received, shutting down`);
  clearInterval(ticker);
  // closes the http server too
  void io.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
