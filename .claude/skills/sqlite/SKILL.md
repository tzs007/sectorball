---
name: sqlite
description: Use when reading/writing the SQLite database in api — node:sqlite DatabaseSync, migrations via PRAGMA user_version, prepared statements, repositories, tests with :memory:
---

# SQLite (`node:sqlite`)

## Rules
- Use `DatabaseSync` from `node:sqlite` (built in, synchronous). Only `models/sqlite/*` and `db/sqlite.ts` may import it;
  services and controllers see repository interfaces only (repositories stay `async`, the Supabase version will be).
- **Always prepared statements** with named parameters: `db.prepare('SELECT * FROM users WHERE id = $id').get({ id })`.
  Never build SQL by string concatenation or template interpolation.
- On open: `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
- **Migrations**: schema changes only as new, numbered entries appended to the `MIGRATIONS` array in `db/sqlite.ts`.
  The applied version lives in `PRAGMA user_version`; never edit an already-shipped entry.
- Map snake_case rows to camelCase domain types inside the repository; rows never leak out of `models/sqlite/*`.
- Store timestamps as ISO strings (`new Date().toISOString()`).
- Keep SQL Postgres-compatible to ease the Supabase move: `TEXT` ids, no SQLite-only types or quirks.
- Tests use `openDatabase(':memory:')` — a fresh, migrated database per test.
- `node:sqlite` is experimental: `dev`/`start` scripts pass `--disable-warning=ExperimentalWarning`.

## Example
```ts
import { DatabaseSync } from 'node:sqlite';

export function findById(db: DatabaseSync, id: string): User | null {
  const row = db.prepare('SELECT id, nickname, created_at FROM users WHERE id = $id').get({ id });
  return row ? { id: row.id as string, nickname: row.nickname as string, createdAt: row.created_at as string } : null;
}
```
