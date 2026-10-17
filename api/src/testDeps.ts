import { openDatabase } from './db/sqlite.ts';
import { createSqlitePlayerRepository } from './models/sqlite/playerRepository.ts';
import { createSessionService } from './services/sessionService.ts';
import type { AppDeps } from './app.ts';

export const testDeps = (): AppDeps => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  return { sessions: createSessionService({ players, now: () => new Date() }) };
};
