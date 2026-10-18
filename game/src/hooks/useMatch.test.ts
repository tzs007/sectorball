import { act, renderHook } from '@testing-library/react';
import { createGame } from '@sectorball/shared';
import type { AckResult, MatchView, Replay } from '@sectorball/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSocket } from '../services/gameSocket';
import { useMatch } from './useMatch';

type Handler = (...args: unknown[]) => void;

/** Minimal stand-in for a Socket.IO client socket: records client emits, lets the test play the server. */
const createFakeSocket = () => {
  const handlers = new Map<string, Set<Handler>>();
  const socket = {
    connected: false,
    on: (event: string, handler: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return socket;
    },
    off: (event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return socket;
    },
    emit: vi.fn((..._args: unknown[]) => socket),
    disconnect: vi.fn(() => {
      socket.connected = false;
      return socket;
    }),
  };
  const serverEmit = (event: string, ...args: unknown[]) => {
    act(() => {
      for (const handler of handlers.get(event) ?? []) handler(...args);
    });
  };
  const emitsOf = (event: string) => socket.emit.mock.calls.filter(([name]) => name === event);
  /** Answers the latest client emit of `event` through its ack callback. */
  const ack = (event: string, result: AckResult<unknown>) => {
    const last = emitsOf(event).at(-1);
    const callback = last?.at(-1);
    if (typeof callback !== 'function') throw new Error(`no ack callback for ${event}`);
    act(() => {
      (callback as (res: AckResult<unknown>) => void)(result);
    });
  };
  return {
    socket,
    asGameSocket: socket as unknown as GameSocket,
    connect: () => {
      socket.connected = true;
      serverEmit('connect');
    },
    serverEmit,
    emitsOf,
    ack,
    listenerCount: () => [...handlers.values()].reduce((n, set) => n + set.size, 0),
  };
};

const MATCH_ID = 'm1';

const view = (seq: number, overrides: Partial<MatchView> = {}): MatchView => ({
  id: MATCH_ID,
  status: 'live',
  home: { id: 'p1', nickname: 'Anna' },
  away: { id: 'p2', nickname: 'Béla' },
  createdAt: '2026-10-18T10:00:00.000Z',
  state: { ...createGame({ matchId: MATCH_ID, firstKickoff: 'home', now: 0 }), seq },
  connected: { home: true, away: true },
  serverNow: 0,
  ...overrides,
});

const replay = (): Replay => ({ frames: [], frameMs: 16 });

const setup = () => {
  const fake = createFakeSocket();
  const factory = vi.fn(() => fake.asGameSocket);
  const hook = renderHook(() => useMatch('tok', MATCH_ID, factory));
  return { ...fake, factory, hook };
};

/** Connected and watching, with `initial` as the current view. */
const watching = (initial = view(0)) => {
  const ctx = setup();
  ctx.connect();
  ctx.ack('match:watch', { ok: true, data: initial });
  return ctx;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMatch', () => {
  it('connects with the token and watches the match on connect', () => {
    const { factory, connect, emitsOf, hook } = setup();
    expect(factory).toHaveBeenCalledWith('tok');
    expect(hook.result.current.status).toBe('connecting');
    connect();
    expect(emitsOf('match:watch')).toHaveLength(1);
    expect(emitsOf('match:watch')[0]?.[1]).toBe(MATCH_ID);
  });

  it('stores the watched view and the server clock offset', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const initial = view(0, { serverNow: 1_500 });
    const { hook } = watching(initial);
    expect(hook.result.current.view).toEqual(initial);
    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.serverClockOffsetMs).toBe(500);
  });

  it('watches again after a reconnect', () => {
    const { connect, emitsOf } = watching();
    connect();
    expect(emitsOf('match:watch')).toHaveLength(2);
  });

  it('replaces the view on match:updated while no replay plays', () => {
    const { serverEmit, hook } = watching();
    const next = view(1);
    serverEmit('match:updated', next);
    expect(hook.result.current.view).toBe(next);
  });

  it('plays a shot replay and shows its view once the replay finished', () => {
    const initial = view(0);
    const { serverEmit, hook } = watching(initial);
    const shot = { matchId: MATCH_ID, replay: replay(), view: view(1) };
    serverEmit('game:shot', shot);
    expect(hook.result.current.replayItem).toEqual({ replay: shot.replay, view: shot.view });
    expect(hook.result.current.view).toBe(initial);
    act(() => {
      hook.result.current.finishReplay();
    });
    expect(hook.result.current.replayItem).toBeNull();
    expect(hook.result.current.view).toBe(shot.view);
  });

  it('queues a shot that arrives while a replay plays', () => {
    const { serverEmit, hook } = watching();
    const first = { matchId: MATCH_ID, replay: replay(), view: view(1) };
    const second = { matchId: MATCH_ID, replay: replay(), view: view(2) };
    serverEmit('game:shot', first);
    serverEmit('game:shot', second);
    expect(hook.result.current.replayItem?.replay).toBe(first.replay);
    act(() => {
      hook.result.current.finishReplay();
    });
    expect(hook.result.current.view).toBe(first.view);
    expect(hook.result.current.replayItem?.replay).toBe(second.replay);
    act(() => {
      hook.result.current.finishReplay();
    });
    expect(hook.result.current.view).toBe(second.view);
    expect(hook.result.current.replayItem).toBeNull();
  });

  it('applies a match:updated received during a replay after the queue drained', () => {
    const { serverEmit, hook } = watching();
    serverEmit('game:shot', { matchId: MATCH_ID, replay: replay(), view: view(1) });
    const update = view(1, { connected: { home: true, away: false } });
    serverEmit('match:updated', update);
    expect(hook.result.current.view?.state?.seq).toBe(0);
    act(() => {
      hook.result.current.finishReplay();
    });
    expect(hook.result.current.view).toBe(update);
  });

  it('drops a pending update that a later shot supersedes', () => {
    const { serverEmit, hook } = watching();
    serverEmit('game:shot', { matchId: MATCH_ID, replay: replay(), view: view(1) });
    serverEmit('match:updated', view(1));
    const second = { matchId: MATCH_ID, replay: replay(), view: view(2) };
    serverEmit('game:shot', second);
    act(() => {
      hook.result.current.finishReplay();
    });
    act(() => {
      hook.result.current.finishReplay();
    });
    expect(hook.result.current.view).toBe(second.view);
  });

  it('shoots with the current seq', () => {
    const { emitsOf, hook } = watching(view(3));
    act(() => {
      hook.result.current.shoot('home-2', { x: 10, y: -5 });
    });
    expect(emitsOf('game:shoot')[0]?.[1]).toEqual({
      matchId: MATCH_ID,
      seq: 3,
      pieceId: 'home-2',
      pull: { x: 10, y: -5 },
    });
  });

  it('sends declareShot, confirmKeeper with the seq and moveKeeper with y', () => {
    const { emitsOf, hook } = watching(view(4));
    act(() => {
      hook.result.current.declareShot();
      hook.result.current.confirmKeeper();
      hook.result.current.moveKeeper(120);
    });
    expect(emitsOf('game:declareShot')[0]?.[1]).toEqual({ matchId: MATCH_ID, seq: 4 });
    expect(emitsOf('game:confirmKeeper')[0]?.[1]).toEqual({ matchId: MATCH_ID, seq: 4 });
    expect(emitsOf('game:moveKeeper')[0]?.[1]).toEqual({ matchId: MATCH_ID, y: 120 });
  });

  it('puts an ack error into error', () => {
    const { ack, hook } = watching();
    act(() => {
      hook.result.current.shoot('home-1', { x: 10, y: 0 });
    });
    ack('game:shoot', { ok: false, error: 'notYourTurn' });
    expect(hook.result.current.error).toBe('notYourTurn');
  });

  it('ignores staleState acks (the server pushes the next update)', () => {
    const { ack, hook } = watching();
    act(() => {
      hook.result.current.declareShot();
    });
    ack('game:declareShot', { ok: false, error: 'staleState' });
    expect(hook.result.current.error).toBeNull();
  });

  it('reports the match as gone when watch answers matchNotFound', () => {
    const { connect, ack, hook } = setup();
    connect();
    ack('match:watch', { ok: false, error: 'matchNotFound' });
    expect(hook.result.current.status).toBe('gone');
  });

  it('reports the match as gone when it was abandoned', () => {
    const { serverEmit, hook } = watching();
    serverEmit('match:updated', view(0, { status: 'abandoned' }));
    expect(hook.result.current.status).toBe('gone');
  });

  it('removes its listeners and disconnects on unmount', () => {
    const { socket, hook, listenerCount } = watching();
    hook.unmount();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(listenerCount()).toBe(0);
  });
});
