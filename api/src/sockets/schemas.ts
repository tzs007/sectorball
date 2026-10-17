import type { PieceId } from '@sectorball/shared';
import { z } from 'zod';

export const matchIdSchema = z.string().min(1);

const seq = z.number().int().min(0);

export const shootSchema = z.object({
  matchId: matchIdSchema,
  seq,
  pieceId: z
    .string()
    .regex(/^(home|away)-([1-5]|gk)$/)
    .transform((id) => id as PieceId),
  pull: z.object({ x: z.number(), y: z.number() }),
});

export const seqActionSchema = z.object({ matchId: matchIdSchema, seq });

export const moveKeeperSchema = z.object({ matchId: matchIdSchema, y: z.number() });
