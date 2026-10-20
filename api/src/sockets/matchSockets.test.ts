import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SHOT } from '@sectorball/shared';
import type { ClientToServerEvents, MatchView, ServerToClientEvents } from '@sectorball/shared';
import { Server } from 'socket.io';
import { io as connectClient, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type AppDeps } from '../app.ts';
import { testDeps } from '../testDeps.ts';
import { attachMatchSockets, type MatchServer } from './matchSockets.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const PULL = { x: SHOT.minPull, y: 0 };

let deps: AppDeps;
let httpServer: HttpServer;
let io: MatchServer;
let url: string;
let clients: Client[];

beforeEach(async () => {
  // random 0.1 → home kicks off; service changes are pushed like in index.ts
  deps = testDeps({
    random: () => 0.1,
    onChange: (view) => {
      sockets.broadcast(view);
    },
  });
  httpServer = createServer(createApp(deps));
  io = new Server(httpServer);
  const sockets = attachMatchSockets(io, deps);
  clients = [];
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  await io.close();
});

const socketFor = (token?: string): Client => {
  const client: Client = connectClient(url, {
    auth: token === undefined ? {} : { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ackTimeout: 2000,
  });
  clients.push(client);
  return client;
};

const connect = (token: string): Promise<Client> => {
  const client = socketFor(token);
  return new Promise((resolve, reject) => {
    client.once('connect', () => {
      resolve(client);
    });
    client.once('connect_error', reject);
  });
};

const nextUpdate = (client: Client, predicate: (view: MatchView) => boolean): Promise<MatchView> =>
  new Promise((resolve) => {
    const listener = (view: MatchView) => {
      if (!predicate(view)) return;
      client.off('match:updated', listener);
      resolve(view);
    };
    client.on('match:updated', listener);
  });

const guest = async (nickname: string) => (await deps.sessions.createGuest(nickname)).token;

const liveMatch = async () => {
  const homeGuest = await deps.sessions.createGuest('Alice');
  const awayGuest = await deps.sessions.createGuest('Bob');
  const created = await deps.matches.create(homeGuest.player);
  await deps.matches.join(created.id, awayGuest.player);
  return { matchId: created.id, homeToken: homeGuest.token, awayToken: awayGuest.token };
};

/** Connects both players and has each watch the match. */
const bothWatching = async () => {
  const match = await liveMatch();
  const home = await connect(match.homeToken);
  const away = await connect(match.awayToken);
  await home.emitWithAck('match:watch', match.matchId);
  const ack = await away.emitWithAck('match:watch', match.matchId);
  return { ...match, home, away, ack };
};

describe('match sockets', () => {
  it('rejects a connection without a valid token', async () => {
    const withoutToken = socketFor();
    const error = await new Promise<Error>((resolve) => withoutToken.once('connect_error', resolve));
    expect(error.message).toBe('unauthorized');

    const badToken = socketFor('not-a-token');
    const badError = await new Promise<Error>((resolve) => badToken.once('connect_error', resolve));
    expect(badError.message).toBe('unauthorized');
  });

  it('pushes the started game to the creator watching the open match', async () => {
    const homeGuest = await deps.sessions.createGuest('Alice');
    const awayGuest = await deps.sessions.createGuest('Bob');
    const { id: matchId } = await deps.matches.create(homeGuest.player);
    const home = await connect(homeGuest.token);
    const watched = await home.emitWithAck('match:watch', matchId);
    expect(watched.ok && watched.data.status).toBe('open');

    const started = nextUpdate(home, (view) => view.status === 'live');
    await deps.matches.join(matchId, awayGuest.player);

    const view = await started;
    expect(view.away?.nickname).toBe('Bob');
    expect(view.state).not.toBeNull();
  });

  it('lets both players watch the match', async () => {
    const { ack } = await bothWatching();
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.data.connected).toEqual({ home: true, away: true });
    expect(ack.data.state?.seq).toBe(0);
  });

  it('applies a shot and sends the replay to both players', async () => {
    const { matchId, home, away } = await bothWatching();
    const shots = [home, away].map(
      (client) =>
        new Promise<Parameters<ServerToClientEvents['game:shot']>[0]>((resolve) => client.once('game:shot', resolve)),
    );

    const ack = await home.emitWithAck('game:shoot', { matchId, seq: 0, pieceId: 'home-1', pull: PULL });

    expect(ack).toEqual({ ok: true, data: null });
    for (const shot of await Promise.all(shots)) {
      expect(shot.matchId).toBe(matchId);
      expect(shot.replay.frames.length).toBeGreaterThan(0);
      expect(shot.view.state?.seq).toBe(1);
    }
  });

  it('passes engine and stale-state errors through the ack', async () => {
    const { matchId, home, away } = await bothWatching();

    expect(await away.emitWithAck('game:shoot', { matchId, seq: 0, pieceId: 'away-1', pull: PULL })).toEqual({
      ok: false,
      error: 'notYourTurn',
    });
    expect(await home.emitWithAck('game:confirmKeeper', { matchId, seq: 0 })).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    expect(await home.emitWithAck('game:declareShot', { matchId, seq: 5 })).toEqual({
      ok: false,
      error: 'staleState',
    });
  });

  it('rejects malformed payloads and non-participants', async () => {
    const { matchId, home } = await bothWatching();

    const malformed = { matchId, seq: 0, pieceId: 'home-1', pull: 'x' } as unknown as Parameters<
      ClientToServerEvents['game:shoot']
    >[0];
    expect(await home.emitWithAck('game:shoot', malformed)).toEqual({ ok: false, error: 'invalidPayload' });
    const badPiece = { matchId, seq: 0, pieceId: 'home-9', pull: PULL } as unknown as Parameters<
      ClientToServerEvents['game:shoot']
    >[0];
    expect(await home.emitWithAck('game:shoot', badPiece)).toEqual({ ok: false, error: 'invalidPayload' });
    expect(await home.emitWithAck('game:declareShot', { matchId, seq: -1 })).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(await home.emitWithAck('match:watch', 42 as unknown as string)).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(await home.emitWithAck('match:watch', 'no-such-match')).toEqual({ ok: false, error: 'matchNotFound' });

    const carol = await connect(await guest('Carol'));
    expect(await carol.emitWithAck('match:watch', matchId)).toEqual({ ok: false, error: 'notParticipant' });
    expect(await carol.emitWithAck('game:declareShot', { matchId, seq: 0 })).toEqual({
      ok: false,
      error: 'notParticipant',
    });
  });

  it('survives events emitted without an ack callback', async () => {
    const { matchId, home } = await bothWatching();
    home.emit('match:watch', matchId, undefined as unknown as Parameters<ClientToServerEvents['match:watch']>[1]);
    home.emit('game:moveKeeper', { matchId, y: 'x' } as unknown as Parameters<ClientToServerEvents['game:moveKeeper']>[0]);

    // the socket still works afterwards
    const ack = await home.emitWithAck('match:watch', matchId);
    expect(ack.ok).toBe(true);
  });

  it('a reconnecting player receives the current view', async () => {
    const { matchId, home, away, awayToken } = await bothWatching();
    await home.emitWithAck('game:shoot', { matchId, seq: 0, pieceId: 'home-1', pull: PULL });

    const awayGone = nextUpdate(home, (view) => !view.connected.away);
    away.disconnect();
    expect((await awayGone).connected.away).toBe(false);

    const awayBack = nextUpdate(home, (view) => view.connected.away);
    const again = await connect(awayToken);
    const ack = await again.emitWithAck('match:watch', matchId);
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.data.state?.seq).toBe(1);
    expect(ack.data.connected.away).toBe(true);
    expect((await awayBack).connected.away).toBe(true);
  });

  it('keeps a player connected while another of their sockets watches the match', async () => {
    const { matchId, home, away, awayToken } = await bothWatching();
    const secondTab = await connect(awayToken);
    await secondTab.emitWithAck('match:watch', matchId);

    const awayOnServer = io.of('/').sockets.get(away.id ?? '');
    if (!awayOnServer) throw new Error('expected the away socket on the server');
    // registered after the match handlers, so it fires once their disconnect handler has started
    const gone = new Promise((resolve) => awayOnServer.once('disconnect', resolve));
    away.disconnect();
    await gone;

    const ack = await home.emitWithAck('match:watch', matchId);
    expect(ack.ok && ack.data.connected.away).toBe(true);
  });
});
