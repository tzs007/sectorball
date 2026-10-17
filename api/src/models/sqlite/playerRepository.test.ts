import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../db/sqlite.ts';
import { createSqlitePlayerRepository } from './playerRepository.ts';

const PLAYER = { id: 'p1', nickname: 'Alice', tokenHash: 'hash-p1', createdAt: '2026-01-01T00:00:00.000Z' };

describe('sqlite player repository', () => {
  it('stores a player and finds it by token hash and by id', async () => {
    const players = createSqlitePlayerRepository(openDatabase(':memory:'));
    await players.create(PLAYER);

    expect(await players.findByTokenHash('hash-p1')).toEqual(PLAYER);
    expect(await players.findById('p1')).toEqual(PLAYER);
    expect(await players.findByTokenHash('nope')).toBeUndefined();
    expect(await players.findById('nope')).toBeUndefined();
  });
});
