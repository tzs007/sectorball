import type { PlayerInfo } from '@sectorball/shared';
import type { RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../errors.ts';
import type { SessionService } from '../services/sessionService.ts';

const BEARER = /^Bearer (.+)$/;

export const requireAuth =
  (sessions: SessionService): RequestHandler =>
  async (req, res, next) => {
    const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
    const player = token ? await sessions.authenticate(token) : undefined;
    if (!player) throw new UnauthorizedError('unauthorized');
    res.locals.player = player;
    next();
  };

export const getPlayer = (res: Response): PlayerInfo => {
  const player = res.locals.player as PlayerInfo | undefined;
  if (!player) throw new UnauthorizedError('unauthorized');
  return player;
};
