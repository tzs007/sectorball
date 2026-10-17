import { Router } from 'express';
import { createMatchController } from '../controllers/matchController.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { MatchService } from '../services/matchService.ts';
import type { SessionService } from '../services/sessionService.ts';

export const createMatchesRouter = (matches: MatchService, sessions: SessionService) => {
  const controller = createMatchController(matches);
  return Router()
    .use(requireAuth(sessions))
    .get('/', controller.list)
    .post('/', controller.create)
    .post('/:id/join', controller.join)
    .get('/:id', controller.get)
    .delete('/:id', controller.remove);
};
