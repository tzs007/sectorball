import { Router } from 'express';
import { z } from 'zod';
import { createSessionController } from '../controllers/sessionController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import type { SessionService } from '../services/sessionService.ts';

const createSessionSchema = z.object({ nickname: z.string() });

export const createSessionsRouter = (sessions: SessionService) => {
  const controller = createSessionController(sessions);
  return Router()
    .post('/', validateBody(createSessionSchema), controller.create)
    .get('/me', requireAuth(sessions), controller.me);
};
