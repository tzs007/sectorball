import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Append-only: index = schema version - 1. Never edit a shipped entry. */
export const MIGRATIONS: readonly string[] = [
  `
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
  `,
];

export function openDatabase(path: string): DatabaseSync {
  const inMemory = path === ':memory:';
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  try {
    if (!inMemory) db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

function migrate(db: DatabaseSync): void {
  const current = db.prepare('PRAGMA user_version').get()?.user_version as number;
  if (current >= MIGRATIONS.length) return;

  db.exec('BEGIN');
  try {
    for (const sql of MIGRATIONS.slice(current)) db.exec(sql);
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
