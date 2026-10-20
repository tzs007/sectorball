import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.ts';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from './errors.ts';
import { createHealthRouter } from './routes/health.ts';
import { createMatchesRouter } from './routes/matches.ts';
import { createSessionsRouter } from './routes/sessions.ts';
import type { MatchService } from './services/matchService.ts';
import type { SessionService } from './services/sessionService.ts';

export type AppDeps = {
  readonly sessions: SessionService;
  readonly matches: MatchService;
};

const statusFor = (err: unknown): number | undefined => {
  if (err instanceof ValidationError) return 400;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ConflictError) return 409;
  return undefined;
};

const isJsonParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';

export const createApp = (deps: AppDeps) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter());
  app.use('/api/sessions', createSessionsRouter(deps.sessions));
  app.use('/api/matches', createMatchesRouter(deps.matches, deps.sessions));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'notFound' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = statusFor(err);
    if (status !== undefined) {
      res.status(status).json({ error: (err as { code: string }).code });
      return;
    }
    if (isJsonParseError(err)) {
      res.status(400).json({ error: 'invalidJson' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: config.isProduction ? 'Internal server error' : String(err) });
  };
  app.use(onError);

  return app;
};
