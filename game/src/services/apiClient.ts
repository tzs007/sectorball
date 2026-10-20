import type { MatchSummary, MatchView, PlayerInfo } from '@sectorball/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const parseBody = async (res: Response): Promise<unknown> => {
  const text = await res.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const errorCode = (body: unknown): string => {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return 'httpError';
};

export const createApiClient = (fetchFn: typeof fetch = (...args) => fetch(...args)) => {
  const request = async <T>(path: string, method: string, token?: string, json?: unknown): Promise<T> => {
    const headers: Record<string, string> = {};
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetchFn(path, {
      method,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    const body = await parseBody(res);
    if (!res.ok) throw new ApiError(res.status, errorCode(body));
    return body as T;
  };

  return {
    createSession: (nickname: string) =>
      request<{ token: string; player: PlayerInfo }>('/api/sessions', 'POST', undefined, { nickname }),
    me: (token: string) => request<PlayerInfo>('/api/sessions/me', 'GET', token),
    listMatches: async (token: string) =>
      (await request<{ items: MatchSummary[] }>('/api/matches', 'GET', token)).items,
    createMatch: (token: string) => request<MatchView>('/api/matches', 'POST', token),
    joinMatch: (token: string, id: string) =>
      request<MatchView>(`/api/matches/${encodeURIComponent(id)}/join`, 'POST', token),
    cancelMatch: async (token: string, id: string): Promise<void> => {
      await request<undefined>(`/api/matches/${encodeURIComponent(id)}`, 'DELETE', token);
    },
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
