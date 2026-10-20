import type {
  AckResult,
  ClientToServerEvents,
  MatchView,
  PlayerInfo,
  ServerToClientEvents,
} from '@sectorball/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../errors.ts';
import type { MatchService } from '../services/matchService.ts';
import type { SessionService } from '../services/sessionService.ts';
import { matchIdSchema, moveKeeperSchema, seqActionSchema, shootSchema } from './schemas.ts';

type SocketData = { player: PlayerInfo };
export type MatchServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type MatchSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomOf = (matchId: string): string => `match:${matchId}`;

const parse = <S extends z.ZodType>(schema: S, payload: unknown): z.output<S> => {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError('invalidPayload');
  return result.data;
};

const errorCode = (err: unknown): string => {
  if (
    err instanceof ValidationError ||
    err instanceof ConflictError ||
    err instanceof NotFoundError ||
    err instanceof UnauthorizedError
  ) {
    return err.code;
  }
  console.error(err);
  return 'internalError';
};

/** Runs an action and never rejects: failures become an error result (unexpected ones are logged). */
const attempt = async <T>(action: () => T | Promise<T>): Promise<AckResult<T>> => {
  try {
    return { ok: true, data: await action() };
  } catch (err) {
    return { ok: false, error: errorCode(err) };
  }
};

/** Acks the result; a client may emit without an ack callback. */
const reply = <T>(ack: unknown, result: AckResult<T>): void => {
  if (typeof ack === 'function') (ack as (res: AckResult<T>) => void)(result);
};

const withoutData = (result: AckResult<unknown>): AckResult<null> => (result.ok ? { ok: true, data: null } : result);

export const attachMatchSockets = (
  io: MatchServer,
  deps: { sessions: SessionService; matches: MatchService },
): { broadcast(view: MatchView): void } => {
  const { sessions, matches } = deps;

  const broadcast = (view: MatchView): void => {
    io.to(roomOf(view.id)).emit('match:updated', view);
  };

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string') {
      next(new Error('unauthorized'));
      return;
    }
    sessions.authenticate(token).then(
      (player) => {
        if (!player) {
          next(new Error('unauthorized'));
          return;
        }
        socket.data.player = player;
        next();
      },
      (err: unknown) => {
        console.error(err);
        next(new Error('internalError'));
      },
    );
  });

  io.on('connection', (socket: MatchSocket) => {
    const { player } = socket.data;
    /** Matches this socket watches, to update presence on disconnect. */
    const watched = new Set<string>();

    const watch = async (payload: unknown): Promise<MatchView> => {
      const matchId = parse(matchIdSchema, payload);
      const team = matches.teamOf(matchId, player.id);
      if (team === null) throw new ConflictError('notParticipant');
      await socket.join(roomOf(matchId));
      watched.add(matchId);
      return matches.setConnected(matchId, team, true);
    };

    /** Marks the player disconnected unless another of their sockets still watches the match. */
    const leave = async (matchId: string): Promise<void> => {
      const remaining = await io.in(roomOf(matchId)).fetchSockets();
      if (remaining.some((s) => s.data.player.id === player.id)) return;
      const team = matches.teamOf(matchId, player.id);
      if (team) broadcast(matches.setConnected(matchId, team, false));
    };

    socket.on('match:watch', (payload: unknown, ack: unknown) => {
      void attempt(() => watch(payload)).then((result) => {
        reply(ack, result);
        if (result.ok) broadcast(result.data);
      });
    });

    socket.on('game:shoot', (payload: unknown, ack: unknown) => {
      void attempt(() => {
        const input = parse(shootSchema, payload);
        return matches.shoot(input.matchId, player.id, input);
      }).then((result) => {
        reply(ack, withoutData(result));
        if (!result.ok) return;
        const { view, replay } = result.data;
        io.to(roomOf(view.id)).emit('game:shot', { matchId: view.id, replay, view });
      });
    });

    socket.on('game:declareShot', (payload: unknown, ack: unknown) => {
      void attempt(() => {
        const { matchId, seq } = parse(seqActionSchema, payload);
        return matches.declareShot(matchId, player.id, seq);
      }).then((result) => {
        reply(ack, withoutData(result));
        if (result.ok) broadcast(result.data);
      });
    });

    socket.on('game:confirmKeeper', (payload: unknown, ack: unknown) => {
      void attempt(() => {
        const { matchId, seq } = parse(seqActionSchema, payload);
        return matches.confirmKeeper(matchId, player.id, seq);
      }).then((result) => {
        reply(ack, withoutData(result));
        if (result.ok) broadcast(result.data);
      });
    });

    // fire-and-forget (no ack): invalid moves are dropped
    socket.on('game:moveKeeper', (payload: unknown) => {
      void attempt(() => {
        const { matchId, y } = parse(moveKeeperSchema, payload);
        return matches.moveKeeper(matchId, player.id, y);
      }).then((result) => {
        if (result.ok) broadcast(result.data);
      });
    });

    socket.on('disconnect', () => {
      for (const matchId of watched) void attempt(() => leave(matchId));
    });
  });

  return { broadcast };
};
