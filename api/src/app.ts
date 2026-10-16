import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.ts';
import { createHealthRouter } from './routes/health.ts';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter());

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: config.isProduction ? 'Internal server error' : String(err) });
  };
  app.use(onError);

  return app;
};
