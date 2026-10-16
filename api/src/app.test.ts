import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

describe('createApp', () => {
  const app = createApp();

  it('GET /api/health responds with ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('responds 404 with a JSON error for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
