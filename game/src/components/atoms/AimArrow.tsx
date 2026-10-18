import type { Vec } from '@sectorball/shared';
import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';
import { THEME } from '../../constants/theme';
import { aimGeometry } from '../../utils/aim';

export type AimArrowProps = { readonly from: Vec; readonly pull: Vec };

const BAND = { width: 1.5, color: THEME.aim, alpha: 0.6 } as const;
const MIN_WIDTH = 2;
const MAX_WIDTH = 6;
const MIN_ALPHA = 0.4;
const HEAD_LENGTH = 16;
const HEAD_HALF_WIDTH = 9;

/** Slingshot feedback: thin rubber band toward the pointer, power-scaled arrow toward the shot. */
export const AimArrow = ({ from, pull }: AimArrowProps) => {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      const { band, direction, power } = aimGeometry(from, pull);
      g.moveTo(from.x, from.y).lineTo(band.x, band.y).stroke(BAND);

      const dx = direction.x - from.x;
      const dy = direction.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const ux = dx / len;
      const uy = dy / len;
      const alpha = MIN_ALPHA + (1 - MIN_ALPHA) * power;
      const width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * power;
      const head = Math.min(HEAD_LENGTH, len);
      const baseX = direction.x - ux * head;
      const baseY = direction.y - uy * head;

      g.moveTo(from.x, from.y).lineTo(baseX, baseY).stroke({ width, color: THEME.aim, alpha });
      g.poly([
        direction.x,
        direction.y,
        baseX - uy * HEAD_HALF_WIDTH,
        baseY + ux * HEAD_HALF_WIDTH,
        baseX + uy * HEAD_HALF_WIDTH,
        baseY - ux * HEAD_HALF_WIDTH,
      ]).fill({ color: THEME.aim, alpha });
    },
    [from, pull],
  );

  return <pixiGraphics draw={draw} eventMode="none" />;
};
