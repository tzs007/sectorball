import { PIECE } from '@sectorball/shared';
import type { Vec } from '@sectorball/shared';
import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';
import { THEME } from '../../constants/theme';

export type BallProps = { readonly pos: Vec };

/** Placeholder ball: flat circle centred on `pos` (pitch units). */
export const Ball = ({ pos }: BallProps) => {
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.circle(0, 0, PIECE.ballRadius).fill(THEME.ball);
  }, []);

  return <pixiGraphics draw={draw} x={pos.x} y={pos.y} eventMode="none" />;
};
