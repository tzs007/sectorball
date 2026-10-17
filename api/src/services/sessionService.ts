import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PlayerInfo } from '@sectorball/shared';
import { ValidationError } from '../errors.ts';
import type { PlayerRepository } from '../models/player.ts';
import { toPlayerInfo } from '../views/playerView.ts';

const MIN_NICKNAME = 2;
const MAX_NICKNAME = 20;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export type SessionService = {
  createGuest(nickname: string): Promise<{ token: string; player: PlayerInfo }>;
  authenticate(token: string): Promise<PlayerInfo | undefined>;
};

export const createSessionService = (deps: {
  players: PlayerRepository;
  now: () => Date;
}): SessionService => ({
  async createGuest(rawNickname) {
    const nickname = rawNickname.trim();
    if (nickname.length < MIN_NICKNAME || nickname.length > MAX_NICKNAME) {
      throw new ValidationError('invalidNickname');
    }
    const token = randomBytes(32).toString('base64url');
    const player = {
      id: randomUUID(),
      nickname,
      tokenHash: hashToken(token),
      createdAt: deps.now().toISOString(),
    };
    await deps.players.create(player);
    return { token, player: toPlayerInfo(player) };
  },

  async authenticate(token) {
    const player = await deps.players.findByTokenHash(hashToken(token));
    return player && toPlayerInfo(player);
  },
});
