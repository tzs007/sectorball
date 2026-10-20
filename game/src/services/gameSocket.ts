import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@sectorball/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const connectGameSocket = (token: string): GameSocket => io({ auth: { token } });
