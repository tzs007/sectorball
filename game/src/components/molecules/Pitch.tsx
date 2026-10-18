import { FIELD, GOAL } from '@sectorball/shared';
import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';
import { THEME } from '../../constants/theme';
import { PitchLines } from '../atoms/PitchLines';

const MOUTH = GOAL.mouthBottom - GOAL.mouthTop;

/** Flat pitch over the whole world (field + margin), field lines and both goals behind the goal lines. */
export const Pitch = () => {
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.rect(-FIELD.margin, -FIELD.margin, FIELD.width + 2 * FIELD.margin, FIELD.height + 2 * FIELD.margin).fill(
      THEME.pitch,
    );
    g.rect(-GOAL.depth, GOAL.mouthTop, GOAL.depth, MOUTH)
      .rect(FIELD.width, GOAL.mouthTop, GOAL.depth, MOUTH)
      .fill(THEME.goal);
  }, []);

  return (
    <pixiContainer eventMode="none">
      <pixiGraphics draw={draw} eventMode="none" />
      <PitchLines />
    </pixiContainer>
  );
};
