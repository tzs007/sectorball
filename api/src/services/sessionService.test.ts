import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/sqlite.ts';
import { ValidationError } from '../errors.ts';
import { createSqlitePlayerRepository } from '../models/sqlite/playerRepository.ts';
import { createSessionService } from './sessionService.ts';

const setup = () => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  const sessions = createSessionService({ players, now: () => new Date('2026-01-01T00:00:00Z') });
  return { db, sessions };
};

describe('sessionService', () => {
  it('creates a guest with a trimmed nickname and a long token', async () => {
    const { sessions } = setup();
    const { token, player } = await sessions.createGuest('  Zsolt ');
    expect(player.nickname).toBe('Zsolt');
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('stores only a hash of the token', async () => {
    const { db, sessions } = setup();
    const { token, player } = await sessions.createGuest('Zsolt');
    const row = db.prepare('SELECT token_hash, created_at FROM players WHERE id = ?').get(player.id);
    expect(row?.token_hash).not.toBe(token);
    expect(row?.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('authenticates a valid token and rejects an unknown one', async () => {
    const { sessions } = setup();
    const { token, player } = await sessions.createGuest('Zsolt');
    expect(await sessions.authenticate(token)).toEqual(player);
    expect(await sessions.authenticate('nope')).toBeUndefined();
  });

  it.each(['a', 'x'.repeat(21), '   ', ' a '])('rejects nickname %j', async (nickname) => {
    const { sessions } = setup();
    await expect(sessions.createGuest(nickname)).rejects.toThrow(ValidationError);
  });
});
