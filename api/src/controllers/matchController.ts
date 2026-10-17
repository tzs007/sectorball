import type { RequestHandler } from 'express';
import { getPlayer } from '../middleware/auth.ts';
import type { MatchService } from '../services/matchService.ts';

export const createMatchController = (matches: MatchService) => ({
  list: ((_req, res) => {
    res.json({ items: matches.listOpen() });
  }) satisfies RequestHandler,

  create: (async (_req, res) => {
    const view = await matches.create(getPlayer(res));
    res.status(201).location(`/api/matches/${view.id}`).json(view);
  }) satisfies RequestHandler,

  join: (async (req, res) => {
    res.json(await matches.join(String(req.params.id), getPlayer(res)));
  }) satisfies RequestHandler,

  get: ((req, res) => {
    res.json(matches.get(String(req.params.id)));
  }) satisfies RequestHandler,
});
