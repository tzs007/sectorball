import type { DatabaseSync } from 'node:sqlite';
import type { MatchRepository } from '../match.ts';

export const createSqliteMatchRepository = (db: DatabaseSync): MatchRepository => {
  const insert = db.prepare(
    `INSERT INTO matches (id, home_player_id, away_player_id, home_score, away_score, status, created_at, finished_at)
     VALUES ($id, $homePlayerId, $awayPlayerId, $homeScore, $awayScore, $status, $createdAt, $finishedAt)`,
  );
  const live = db.prepare("UPDATE matches SET status = 'live', away_player_id = $awayPlayerId WHERE id = $id");
  const finished = db.prepare(
    `UPDATE matches SET status = 'finished', home_score = $home, away_score = $away, finished_at = $finishedAt
     WHERE id = $id`,
  );
  const abandonOne = db.prepare("UPDATE matches SET status = 'abandoned' WHERE id = $id");
  const abandonAll = db.prepare("UPDATE matches SET status = 'abandoned' WHERE status IN ('open', 'live')");

  return {
    create(m) {
      insert.run({ ...m });
      return Promise.resolve();
    },
    markLive(id, awayPlayerId) {
      live.run({ id, awayPlayerId });
      return Promise.resolve();
    },
    finish(id, score, finishedAt) {
      finished.run({ id, home: score.home, away: score.away, finishedAt });
      return Promise.resolve();
    },
    abandon(id) {
      abandonOne.run({ id });
      return Promise.resolve();
    },
    abandonUnfinished() {
      return Promise.resolve(Number(abandonAll.run().changes));
    },
  };
};
