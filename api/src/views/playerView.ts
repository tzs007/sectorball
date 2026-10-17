import type { PlayerInfo } from '@sectorball/shared';
import type { Player } from '../models/player.ts';

export const toPlayerInfo = (p: Player): PlayerInfo => ({ id: p.id, nickname: p.nickname });
