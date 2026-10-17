import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, openDatabase } from './sqlite.ts';

function userVersion(db: ReturnType<typeof openDatabase>): number {
  return db.prepare('PRAGMA user_version').get()?.user_version as number;
}

describe('openDatabase', () => {
  it('creates the schema in memory and sets user_version', () => {
    const db = openDatabase(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name);
    expect(names).toContain('players');
    expect(names).toContain('matches');
    expect(userVersion(db)).toBe(MIGRATIONS.length);
    expect(userVersion(db)).toBe(1);
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
    db.close();
  });

  it('can reopen a file database without re-running migrations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sectorball-'));
    try {
      const path = join(dir, 'nested', 'test.db');
      const first = openDatabase(path);
      expect(first.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal');
      first.close();
      const second = openDatabase(path);
      expect(userVersion(second)).toBe(1);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
