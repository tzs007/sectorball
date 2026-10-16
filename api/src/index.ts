import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { config } from './config.ts';

const httpServer = createServer(createApp());

httpServer.listen(config.port, () => {
  console.info(`api listening on http://localhost:${config.port}`);
});

const shutdown = (signal: string): void => {
  console.info(`${signal} received, shutting down`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
