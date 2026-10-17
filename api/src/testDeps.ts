import { openDatabase } from './db/sqlite.ts';
import { createSqliteMatchRepository } from './models/sqlite/matchRepository.ts';
import { createSqlitePlayerRepository } from './models/sqlite/playerRepository.ts';
import { createMatchService } from './services/matchService.ts';
import { createSessionService } from './services/sessionService.ts';
import type { AppDeps } from './app.ts';

export const testDeps = (options: { random?: () => number } = {}): AppDeps => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  const matches = createMatchService({
    matches: createSqliteMatchRepository(db),
    now: Date.now,
    random: options.random ?? Math.random,
  });
  return { sessions: createSessionService({ players, now: () => new Date() }), matches };
};
