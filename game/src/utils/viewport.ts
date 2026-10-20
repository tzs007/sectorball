import { FIELD } from '@sectorball/shared';
import type { Vec } from '@sectorball/shared';

export const WORLD = {
  width: FIELD.width + 2 * FIELD.margin,
  height: FIELD.height + 2 * FIELD.margin,
} as const;

export type Fit = { scale: number; x: number; y: number };

/** Contain-fit of the whole world (pitch plus margin) into the view, centred. */
export const fitToView = (viewWidth: number, viewHeight: number): Fit => {
  const scale = Math.min(viewWidth / WORLD.width, viewHeight / WORLD.height);
  return {
    scale,
    x: (viewWidth - WORLD.width * scale) / 2,
    y: (viewHeight - WORLD.height * scale) / 2,
  };
};

/** Screen (canvas) position to pitch coordinates. */
export const toWorld = (screen: Vec, fit: Fit): Vec => ({
  x: (screen.x - fit.x) / fit.scale - FIELD.margin,
  y: (screen.y - fit.y) / fit.scale - FIELD.margin,
});

/** Pitch coordinates to screen (canvas) position. */
export const toScreen = (world: Vec, fit: Fit): Vec => ({
  x: fit.x + (world.x + FIELD.margin) * fit.scale,
  y: fit.y + (world.y + FIELD.margin) * fit.scale,
});
