import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { testDeps } from '../testDeps.ts';

describe('sessions routes', () => {
  const app = createApp(testDeps());

  it('creates a guest session and resolves it via /me', async () => {
    const created = await request(app).post('/api/sessions').send({ nickname: 'Zsolt' });
    const body = created.body as { token: string; player: { nickname: string } };
    expect(created.status).toBe(201);
    expect(typeof body.token).toBe('string');
    expect(body.player.nickname).toBe('Zsolt');

    const me = await request(app).get('/api/sessions/me').set('Authorization', `Bearer ${body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual(body.player);
  });

  it('rejects /me without or with a bad token', async () => {
    const none = await request(app).get('/api/sessions/me');
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: 'unauthorized' });
    const bad = await request(app).get('/api/sessions/me').set('Authorization', 'Bearer nope');
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects invalid bodies with 400', async () => {
    const wrongType = await request(app).post('/api/sessions').send({ nickname: 5 });
    expect(wrongType.status).toBe(400);
    const tooShort = await request(app).post('/api/sessions').send({ nickname: 'a' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body).toEqual({ error: 'invalidNickname' });
  });

  it('maps malformed JSON to 400 invalidJson', async () => {
    const res = await request(app).post('/api/sessions').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalidJson' });
  });
});
