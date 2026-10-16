import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';

export type BallProps = {
  readonly radius: number;
  readonly color: string;
  readonly x: number;
  readonly y: number;
};

export const Ball = ({ radius, color, x, y }: BallProps) => {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, radius).fill(color);
    },
    [radius, color],
  );

  return <pixiGraphics draw={draw} x={x} y={y} />;
};
