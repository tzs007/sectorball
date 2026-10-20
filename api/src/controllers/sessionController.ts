import type { RequestHandler } from 'express';
import { getPlayer } from '../middleware/auth.ts';
import type { SessionService } from '../services/sessionService.ts';

export const createSessionController = (sessions: SessionService) => ({
  create: (async (req, res) => {
    const { nickname } = req.body as { nickname: string };
    res.status(201).json(await sessions.createGuest(nickname));
  }) satisfies RequestHandler,

  me: ((_req, res) => {
    res.json(getPlayer(res));
  }) satisfies RequestHandler,
});
