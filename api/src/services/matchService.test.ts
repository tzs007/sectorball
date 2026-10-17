import { SHOT, TIMING, declareShot } from '@sectorball/shared';
import type { GameState, MatchView, PlayerInfo } from '@sectorball/shared';
import type * as Shared from '@sectorball/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../db/sqlite.ts';
import { ConflictError, NotFoundError, ValidationError } from '../errors.ts';
import type { MatchRepository } from '../models/match.ts';
import { createSqliteMatchRepository } from '../models/sqlite/matchRepository.ts';
import { createSqlitePlayerRepository } from '../models/sqlite/playerRepository.ts';
import { createMatchService } from './matchService.ts';

// passes through to the engine; single tests override one result
vi.mock('@sectorball/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof Shared>();
  return { ...actual, declareShot: vi.fn(actual.declareShot) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PULL = { x: SHOT.minPull, y: 0 };

const stateOf = (view: MatchView | undefined): GameState => {
  if (!view?.state) throw new Error('expected a view with a game state');
  return view.state;
};

const setup = async (overrides: Partial<MatchRepository> = {}, onChange?: (view: MatchView) => void) => {
  const db = openDatabase(':memory:');
  const players = createSqlitePlayerRepository(db);
  const addPlayer = async (id: string): Promise<PlayerInfo> => {
    await players.create({ id, nickname: `nick-${id}`, tokenHash: `hash-${id}`, createdAt: '2026-01-01T00:00:00Z' });
    return { id, nickname: `nick-${id}` };
  };
  const clock = { now: 1_000_000 };
  const service = createMatchService({
    matches: { ...createSqliteMatchRepository(db), ...overrides },
    now: () => clock.now,
    random: () => 0.1,
    onChange,
  });
  const alice = await addPlayer('alice');
  const bob = await addPlayer('bob');
  const carol = await addPlayer('carol');
  const rowOf = (id: string) => db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  const countRows = () => db.prepare('SELECT COUNT(*) AS n FROM matches').get()?.n;
  return { service, clock, alice, bob, carol, rowOf, countRows };
};

const liveMatch = async (overrides: Partial<MatchRepository> = {}) => {
  const ctx = await setup(overrides);
  const created = await ctx.service.create(ctx.alice);
  const view = await ctx.service.join(created.id, ctx.bob);
  return { ...ctx, view, id: view.id };
};

describe('matchService', () => {
  it('lists a created match as open', async () => {
    const { service, alice, clock } = await setup();
    const view = await service.create(alice);

    expect(view).toMatchObject({ status: 'open', home: alice, away: null, state: null, serverNow: clock.now });
    expect(view.connected).toEqual({ home: false, away: false });
    expect(service.listOpen()).toEqual([
      { id: view.id, status: 'open', home: alice, away: null, createdAt: view.createdAt },
    ]);
  });

  it('lists open matches newest first', async () => {
    const { service, alice, bob, clock } = await setup();
    const older = await service.create(alice);
    clock.now += 1000;
    const newer = await service.create(bob);

    expect(service.listOpen().map((m) => m.id)).toEqual([newer.id, older.id]);
  });

  it('returns the existing open match when its host creates again', async () => {
    const { service, alice, countRows } = await setup();
    const first = await service.create(alice);
    const again = await service.create(alice);

    expect(again.id).toBe(first.id);
    expect(service.listOpen().map((m) => m.id)).toEqual([first.id]);
    expect(countRows()).toBe(1);
  });

  it('lets the host cancel an open match', async () => {
    const { service, alice, rowOf } = await setup();
    const { id } = await service.create(alice);

    await service.cancel(id, alice);

    expect(service.listOpen()).toEqual([]);
    expect(() => service.get(id)).toThrow(new NotFoundError('matchNotFound'));
    expect(rowOf(id)).toMatchObject({ status: 'abandoned' });
    expect((await service.create(alice)).id).not.toBe(id);
  });

  it('rejects cancelling an unknown match, a match of another host or a match that is not open', async () => {
    const { service, alice, bob } = await setup();
    await expect(service.cancel('nope', alice)).rejects.toThrow(new NotFoundError('matchNotFound'));
    const { id } = await service.create(alice);
    await expect(service.cancel(id, bob)).rejects.toThrow(new ConflictError('notHost'));
    await service.join(id, bob);
    await expect(service.cancel(id, alice)).rejects.toThrow(new ConflictError('matchNotOpen'));
    expect(service.get(id).status).toBe('live');
  });

  it('starts the game when a second player joins', async () => {
    const { service, view, bob, rowOf } = await liveMatch();

    expect(view).toMatchObject({ status: 'live', away: bob });
    expect(view.state?.turn).toBe('home');
    expect(service.listOpen()).toEqual([]);
    expect(rowOf(view.id)).toMatchObject({ status: 'live', away_player_id: 'bob' });
  });

  it('reports the join and the cancel of a match as changes', async () => {
    const onChange = vi.fn<(view: MatchView) => void>();
    const { service, alice, bob } = await setup({}, onChange);
    const joined = await service.join((await service.create(alice)).id, bob);
    const { id } = await service.create(bob);
    expect(onChange.mock.calls).toEqual([[joined]]);

    await service.cancel(id, bob);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id, status: 'abandoned' }));
  });

  it('rejects an unknown match', async () => {
    const { service, bob } = await setup();
    await expect(service.join('nope', bob)).rejects.toThrow(new NotFoundError('matchNotFound'));
    expect(() => service.get('nope')).toThrow(new NotFoundError('matchNotFound'));
  });

  it('rejects joining a full match', async () => {
    const { service, id, carol } = await liveMatch();
    await expect(service.join(id, carol)).rejects.toThrow(new ConflictError('matchFull'));
  });

  it('returns the current view when the away player joins again', async () => {
    const onChange = vi.fn<(view: MatchView) => void>();
    const { service, alice, bob } = await setup({}, onChange);
    const { id } = await service.create(alice);
    const joined = await service.join(id, bob);

    const again = await service.join(id, bob);

    expect(again).toEqual(joined);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('rejects joining your own match', async () => {
    const { service, alice } = await setup();
    const { id } = await service.create(alice);
    await expect(service.join(id, alice)).rejects.toThrow(new ConflictError('ownMatch'));
  });

  it('tells the team of a player', async () => {
    const { service, id } = await liveMatch();
    expect(service.teamOf(id, 'alice')).toBe('home');
    expect(service.teamOf(id, 'bob')).toBe('away');
    expect(service.teamOf(id, 'carol')).toBeNull();
  });

  it('tracks connected teams in the view', async () => {
    const { service, id } = await liveMatch();
    expect(service.setConnected(id, 'away', true).connected).toEqual({ home: false, away: true });
    expect(service.get(id).connected).toEqual({ home: false, away: true });
  });

  it('applies a shot and returns its replay', async () => {
    const { service, id, view } = await liveMatch();
    const seq = stateOf(view).seq;
    const { view: next, replay } = await service.shoot(id, 'alice', { seq, pieceId: 'home-1', pull: PULL });

    expect(stateOf(next).seq).toBeGreaterThan(seq);
    expect(replay.frames.length).toBeGreaterThan(0);
    expect(service.get(id).state).toEqual(next.state);
  });

  it('rejects actions with a stale seq', async () => {
    const { service, id } = await liveMatch();
    const input = { seq: 0, pieceId: 'home-1', pull: PULL } as const;
    await service.shoot(id, 'alice', input);

    await expect(service.shoot(id, 'alice', input)).rejects.toThrow(new ValidationError('staleState'));
    await expect(service.declareShot(id, 'bob', 0)).rejects.toThrow(new ValidationError('staleState'));
  });

  it('passes engine errors through as validation errors', async () => {
    const { service, id } = await liveMatch();
    await expect(service.shoot(id, 'bob', { seq: 0, pieceId: 'away-1', pull: PULL })).rejects.toThrow(
      new ValidationError('notYourTurn'),
    );
    await expect(service.confirmKeeper(id, 'alice', 0)).rejects.toThrow(new ValidationError('wrongPhase'));
    expect(() => service.moveKeeper(id, 'bob', 300)).toThrow(new ValidationError('wrongPhase'));
  });

  it('rejects actions by non-participants', async () => {
    const { service, id } = await liveMatch();
    await expect(service.shoot(id, 'carol', { seq: 0, pieceId: 'home-1', pull: PULL })).rejects.toThrow(
      new ConflictError('notParticipant'),
    );
    expect(() => service.moveKeeper(id, 'carol', 300)).toThrow(new ConflictError('notParticipant'));
  });

  it('rejects actions on a match that is not live', async () => {
    const { service, alice } = await setup();
    const { id } = await service.create(alice);
    await expect(service.declareShot(id, 'alice', 0)).rejects.toThrow(new ConflictError('matchNotLive'));
  });

  it('applies a turn timeout on tick', async () => {
    const { service, clock, id } = await liveMatch();
    expect(await service.tick()).toEqual([]);

    clock.now += TIMING.turnLimitMs;
    const views = await service.tick();

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id, serverNow: clock.now });
    expect(stateOf(views[0]).lastDecision).toEqual({ kind: 'turnTimeout', team: 'home' });
  });

  it('finishes the match after two halves and stores the result', async () => {
    const { service, clock, id, rowOf } = await liveMatch();
    clock.now += TIMING.halfLengthMs;
    await service.tick();
    clock.now += TIMING.halfLengthMs;
    const [view] = await service.tick();

    expect(view).toMatchObject({ id, status: 'finished' });
    expect(stateOf(view).phase).toBe('finished');
    expect(rowOf(id)).toMatchObject({
      status: 'finished',
      home_score: 0,
      away_score: 0,
      finished_at: new Date(clock.now).toISOString(),
    });
    expect(await service.tick()).toEqual([]);
    await expect(service.declareShot(id, 'alice', stateOf(view).seq)).rejects.toThrow(
      new ConflictError('matchNotLive'),
    );
  });

  it('applies only one of two concurrent actions for the same seq', async () => {
    const { service, id } = await liveMatch();
    const input = { seq: 0, pieceId: 'home-1', pull: PULL } as const;

    const results = await Promise.allSettled([service.shoot(id, 'alice', input), service.shoot(id, 'alice', input)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected').map((r) => r.reason as unknown)).toEqual([
      new ValidationError('staleState'),
    ]);
  });

  it('keeps its own copy of the players', async () => {
    const { service, alice, bob } = await setup();
    const home = { ...alice };
    const away = { ...bob };
    const { id } = await service.create(home);
    await service.join(id, away);
    Object.assign(home, { nickname: 'changed' });
    Object.assign(away, { nickname: 'changed' });

    expect(service.get(id)).toMatchObject({ home: alice, away: bob });
  });

  it('rolls the join back when it cannot be stored', async () => {
    const { service, alice, bob } = await setup({ markLive: () => Promise.reject(new Error('db down')) });
    const { id } = await service.create(alice);

    await expect(service.join(id, bob)).rejects.toThrow('db down');
    expect(service.listOpen()).toMatchObject([{ id, status: 'open', away: null }]);
    expect(service.get(id).state).toBeNull();
  });

  it('creates only one match for concurrent creates by the same host', async () => {
    const { service, alice, countRows } = await setup();
    const [first, second] = await Promise.all([service.create(alice), service.create(alice)]);

    expect(second.id).toBe(first.id);
    expect(countRows()).toBe(1);
  });

  it('rolls the create back when it cannot be stored', async () => {
    const { service, alice } = await setup({ create: () => Promise.reject(new Error('db down')) });

    await expect(service.create(alice)).rejects.toThrow('db down');
    expect(service.listOpen()).toEqual([]);
  });

  it('keeps the match open when the cancel cannot be stored', async () => {
    const { service, alice } = await setup({ abandon: () => Promise.reject(new Error('db down')) });
    const { id } = await service.create(alice);

    await expect(service.cancel(id, alice)).rejects.toThrow('db down');
    expect(service.listOpen().map((m) => m.id)).toEqual([id]);
  });

  it('keeps the game going when the result cannot be stored', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = await liveMatch({ finish: () => Promise.reject(new Error('db down')) });
    const { service, clock, carol, alice } = ctx;
    clock.now += TIMING.halfLengthMs;
    await service.tick();
    // a second match whose turn runs out in the same tick as the first match ends
    clock.now += TIMING.halfLengthMs - TIMING.turnLimitMs;
    const other = await service.join((await service.create(carol)).id, alice);
    clock.now += TIMING.turnLimitMs;

    const views = await service.tick();

    expect(views.map((v) => [v.id, v.status])).toEqual([
      [ctx.id, 'finished'],
      [other.id, 'live'],
    ]);
    expect(stateOf(views[1]).lastDecision).toEqual({ kind: 'turnTimeout', team: 'home' });
    expect(error).toHaveBeenCalledOnce();
  });

  it('resolves an action that ends the match even when the result cannot be stored', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, id, view } = await liveMatch({ finish: () => Promise.reject(new Error('db down')) });
    // no engine action ends a match today; this pins the service's handling if one does
    vi.mocked(declareShot).mockReturnValueOnce({
      ok: true,
      value: { ...stateOf(view), phase: 'finished', winner: 'draw', seq: 1 },
    });

    await expect(service.declareShot(id, 'alice', 0)).resolves.toMatchObject({ id, status: 'finished' });
    expect(service.get(id).status).toBe('finished');
    expect(error).toHaveBeenCalledOnce();
  });
});
