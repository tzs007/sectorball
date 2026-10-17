import type { MatchSummary, MatchView } from '@sectorball/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { testDeps } from '../testDeps.ts';

const setup = () => {
  const app = createApp(testDeps());
  const guest = async (nickname: string): Promise<string> => {
    const res = await request(app).post('/api/sessions').send({ nickname });
    return `Bearer ${(res.body as { token: string }).token}`;
  };
  const list = async (auth: string) => {
    const res = await request(app).get('/api/matches').set('Authorization', auth);
    return { status: res.status, items: (res.body as { items: MatchSummary[] }).items };
  };
  return { app, guest, list };
};

describe('matches routes', () => {
  it('runs the lobby flow: list, create, join', async () => {
    const { app, guest, list } = setup();
    const a = await guest('Alice');
    const b = await guest('Bob');

    expect(await list(a)).toEqual({ status: 200, items: [] });

    const created = await request(app).post('/api/matches').set('Authorization', a);
    const match = created.body as MatchView;
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`/api/matches/${match.id}`);
    expect(match.status).toBe('open');
    expect(match.home.nickname).toBe('Alice');

    const open = await list(b);
    expect(open.items.map((m) => m.id)).toEqual([match.id]);

    const joined = await request(app).post(`/api/matches/${match.id}/join`).set('Authorization', b);
    const live = joined.body as MatchView;
    expect(joined.status).toBe(200);
    expect(live.status).toBe('live');
    expect(live.away?.nickname).toBe('Bob');
    expect(live.state?.turn).toBeDefined();

    expect((await list(a)).items).toEqual([]);

    const fetched = await request(app).get(`/api/matches/${match.id}`).set('Authorization', a);
    expect(fetched.status).toBe(200);
    expect((fetched.body as MatchView).id).toBe(match.id);
    expect((fetched.body as MatchView).status).toBe('live');
  });

  it('rejects joining your own match and joining a full match', async () => {
    const { app, guest } = setup();
    const a = await guest('Alice');
    const b = await guest('Bob');
    const c = await guest('Carol');
    const { id } = (await request(app).post('/api/matches').set('Authorization', a)).body as MatchView;

    const own = await request(app).post(`/api/matches/${id}/join`).set('Authorization', a);
    expect(own.status).toBe(409);
    expect(own.body).toEqual({ error: 'ownMatch' });

    await request(app).post(`/api/matches/${id}/join`).set('Authorization', b);
    const full = await request(app).post(`/api/matches/${id}/join`).set('Authorization', c);
    expect(full.status).toBe(409);
    expect(full.body).toEqual({ error: 'matchFull' });
  });

  it('lets the host cancel an open match', async () => {
    const { app, guest, list } = setup();
    const a = await guest('Alice');
    const b = await guest('Bob');
    const { id } = (await request(app).post('/api/matches').set('Authorization', a)).body as MatchView;

    const again = await request(app).post('/api/matches').set('Authorization', a);
    expect(again.status).toBe(201);
    expect((again.body as MatchView).id).toBe(id);

    const notHost = await request(app).delete(`/api/matches/${id}`).set('Authorization', b);
    expect(notHost.status).toBe(409);
    expect(notHost.body).toEqual({ error: 'notHost' });

    const cancelled = await request(app).delete(`/api/matches/${id}`).set('Authorization', a);
    expect(cancelled.status).toBe(204);
    expect(cancelled.text).toBe('');
    expect((await list(b)).items).toEqual([]);
  });

  it('returns 404 for an unknown match', async () => {
    const { app, guest } = setup();
    const a = await guest('Alice');
    const get = await request(app).get('/api/matches/nope').set('Authorization', a);
    expect(get.status).toBe(404);
    expect(get.body).toEqual({ error: 'matchNotFound' });
    const join = await request(app).post('/api/matches/nope/join').set('Authorization', a);
    expect(join.status).toBe(404);
    expect(join.body).toEqual({ error: 'matchNotFound' });
  });

  it('requires a token on every route', async () => {
    const { app } = setup();
    for (const res of [
      await request(app).get('/api/matches'),
      await request(app).post('/api/matches'),
      await request(app).post('/api/matches/x/join'),
      await request(app).get('/api/matches/x'),
      await request(app).delete('/api/matches/x'),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'unauthorized' });
    }
  });
});
