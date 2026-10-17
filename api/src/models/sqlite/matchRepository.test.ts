import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../db/sqlite.ts';
import type { MatchRecord } from '../match.ts';
import { createSqliteMatchRepository } from './matchRepository.ts';
import { createSqlitePlayerRepository } from './playerRepository.ts';

const CREATED = '2026-01-01T00:00:00.000Z';

const setup = async () => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  for (const id of ['p1', 'p2']) {
    await players.create({ id, nickname: id, tokenHash: `hash-${id}`, createdAt: CREATED });
  }
  const matches = createSqliteMatchRepository(db);
  const statusOf = (id: string) => db.prepare('SELECT status FROM matches WHERE id = ?').get(id)?.status;
  return { db, matches, statusOf };
};

const record = (id: string): MatchRecord => ({
  id,
  homePlayerId: 'p1',
  awayPlayerId: null,
  homeScore: 0,
  awayScore: 0,
  status: 'open',
  createdAt: CREATED,
  finishedAt: null,
});

describe('sqlite match repository', () => {
  it('stores a match, marks it live and finishes it with the score', async () => {
    const { db, matches } = await setup();
    await matches.create(record('m1'));
    await matches.markLive('m1', 'p2');
    await matches.finish('m1', { home: 2, away: 1 }, '2026-01-01T00:20:00.000Z');

    expect({ ...db.prepare('SELECT * FROM matches WHERE id = ?').get('m1') }).toEqual({
      id: 'm1',
      home_player_id: 'p1',
      away_player_id: 'p2',
      home_score: 2,
      away_score: 1,
      status: 'finished',
      created_at: CREATED,
      finished_at: '2026-01-01T00:20:00.000Z',
    });
  });

  it('abandons a single match', async () => {
    const { matches, statusOf } = await setup();
    await matches.create(record('m1'));
    await matches.create(record('m2'));

    await matches.abandon('m1');

    expect(statusOf('m1')).toBe('abandoned');
    expect(statusOf('m2')).toBe('open');
  });

  it('marks open and live matches abandoned on startup', async () => {
    const { matches, statusOf } = await setup();
    await matches.create(record('open'));
    await matches.create(record('live'));
    await matches.markLive('live', 'p2');
    await matches.create(record('done'));
    await matches.markLive('done', 'p2');
    await matches.finish('done', { home: 0, away: 0 }, CREATED);

    expect(await matches.abandonUnfinished()).toBe(2);
    expect(statusOf('open')).toBe('abandoned');
    expect(statusOf('live')).toBe('abandoned');
    expect(statusOf('done')).toBe('finished');
  });
});
