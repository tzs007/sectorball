import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../errors.ts';

export const validateBody =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'invalidBody');
    req.body = result.data;
    next();
  };
