import type { DatabaseSync } from 'node:sqlite';
import type { Player, PlayerRepository } from '../player.ts';

type PlayerRow = { id: string; nickname: string; token_hash: string; created_at: string };

const toPlayer = (row: PlayerRow | undefined): Player | undefined =>
  row && { id: row.id, nickname: row.nickname, tokenHash: row.token_hash, createdAt: row.created_at };

export const createSqlitePlayerRepository = (db: DatabaseSync): PlayerRepository => {
  const insert = db.prepare('INSERT INTO players (id, nickname, token_hash, created_at) VALUES (?, ?, ?, ?)');
  const byHash = db.prepare('SELECT * FROM players WHERE token_hash = ?');
  const byId = db.prepare('SELECT * FROM players WHERE id = ?');

  return {
    create(p) {
      insert.run(p.id, p.nickname, p.tokenHash, p.createdAt);
      return Promise.resolve();
    },
    findByTokenHash(hash) {
      return Promise.resolve(toPlayer(byHash.get(hash) as PlayerRow | undefined));
    },
    findById(id) {
      return Promise.resolve(toPlayer(byId.get(id) as PlayerRow | undefined));
    },
  };
};
