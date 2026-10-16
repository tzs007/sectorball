import { Router } from 'express';

export const createHealthRouter = () =>
  Router().get('/', (_req, res) => {
    res.json({ ok: true });
  });
