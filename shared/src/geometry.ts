export type Vec = { readonly x: number; readonly y: number };

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y);
export const scale = (v: Vec, k: number): Vec => vec(v.x * k, v.y * k);
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const length = (v: Vec): number => Math.hypot(v.x, v.y);
export const distance = (a: Vec, b: Vec): number => length(sub(a, b));

export const normalize = (v: Vec): Vec => {
  const len = length(v);
  return len === 0 ? vec(0, 0) : vec(v.x / len, v.y / len);
};

export const clampLength = (v: Vec, max: number): Vec => {
  const len = length(v);
  return len > max ? vec((v.x * max) / len, (v.y * max) / len) : v;
};

export const isFiniteVec = (v: Vec): boolean => Number.isFinite(v.x) && Number.isFinite(v.y);
