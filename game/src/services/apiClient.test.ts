import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './apiClient';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  it('creates a session by POSTing the nickname and returns the parsed body', async () => {
    const created = { token: 'tok', player: { id: 'p1', nickname: 'Zsolt' } };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(created, 201));

    const result = await createApiClient(fetchFn).createSession('Zsolt');

    expect(result).toEqual(created);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sessions');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ nickname: 'Zsolt' }));
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('lists matches with the bearer token and returns the items', async () => {
    const items = [{ id: 'm1' }];
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ items }));

    const result = await createApiClient(fetchFn).listMatches('t');

    expect(result).toEqual(items);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/matches');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer t');
  });

  it('rejects non-2xx responses with an ApiError carrying status and code', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'matchFull' }, 409));

    const failure = createApiClient(fetchFn).joinMatch('t', 'm1');

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, code: 'matchFull' });
  });

  it('uses the httpError code when the error body is not JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    await expect(createApiClient(fetchFn).me('t')).rejects.toMatchObject({
      status: 502,
      code: 'httpError',
    });
  });
});
