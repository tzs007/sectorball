export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH ?? 'data/sectorball.db',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
