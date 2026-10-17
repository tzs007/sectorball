import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { openDatabase } from './db/sqlite.ts';
import { createSqliteMatchRepository } from './models/sqlite/matchRepository.ts';
import { createSqlitePlayerRepository } from './models/sqlite/playerRepository.ts';
import { createMatchService } from './services/matchService.ts';
import { createSessionService } from './services/sessionService.ts';

const db = openDatabase(config.databasePath);
const players = createSqlitePlayerRepository(db);
const sessions = createSessionService({ players, now: () => new Date() });

const matchRepository = createSqliteMatchRepository(db);
await matchRepository.abandonLive();
const matches = createMatchService({ matches: matchRepository, now: Date.now, random: Math.random });

const httpServer = createServer(createApp({ sessions, matches }));

httpServer.listen(config.port, () => {
  console.info(`api listening on http://localhost:${config.port}`);
});

const shutdown = (signal: string): void => {
  console.info(`${signal} received, shutting down`);
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
