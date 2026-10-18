import { CENTER, FIELD, PENALTY_AREA, PENALTY_SPOT_DISTANCE } from '@sectorball/shared';
import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';
import { THEME } from '../../constants/theme';

const LINE = { width: 2, color: THEME.lines } as const;
const SPOT_RADIUS = 3;
const PENALTY_HEIGHT = PENALTY_AREA.bottom - PENALTY_AREA.top;

/** Field markings in pitch units (origin = field top-left). */
export const PitchLines = () => {
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.rect(0, 0, FIELD.width, FIELD.height)
      .moveTo(CENTER.x, 0)
      .lineTo(CENTER.x, FIELD.height)
      .circle(CENTER.x, CENTER.y, CENTER.circleRadius)
      .rect(0, PENALTY_AREA.top, PENALTY_AREA.depth, PENALTY_HEIGHT)
      .rect(FIELD.width - PENALTY_AREA.depth, PENALTY_AREA.top, PENALTY_AREA.depth, PENALTY_HEIGHT)
      .stroke(LINE);
    g.circle(CENTER.x, CENTER.y, SPOT_RADIUS)
      .circle(PENALTY_SPOT_DISTANCE, CENTER.y, SPOT_RADIUS)
      .circle(FIELD.width - PENALTY_SPOT_DISTANCE, CENTER.y, SPOT_RADIUS)
      .fill(THEME.lines);
  }, []);

  return <pixiGraphics draw={draw} eventMode="none" />;
};
