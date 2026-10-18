import { PIECE } from '@sectorball/shared';
import type { Piece } from '@sectorball/shared';
import { Rectangle } from 'pixi.js';
import type { FederatedPointerEvent, Graphics } from 'pixi.js';
import { useCallback, useMemo } from 'react';
import { THEME } from '../../constants/theme';

export type KeeperPieceProps = {
  readonly piece: Piece;
  readonly draggable: boolean;
  readonly onDragStart?: (e: FederatedPointerEvent) => void;
};

const HALF_W = PIECE.keeperWidth / 2;
const HALF_H = PIECE.keeperHeight / 2;

/** Placeholder keeper: flat team-coloured rectangle centred on its position. */
export const KeeperPiece = ({ piece, draggable, onDragStart }: KeeperPieceProps) => {
  const hitArea = useMemo(() => new Rectangle(-HALF_W, -HALF_H, PIECE.keeperWidth, PIECE.keeperHeight), []);
  const color = THEME[piece.team];

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(-HALF_W, -HALF_H, PIECE.keeperWidth, PIECE.keeperHeight).fill(color);
    },
    [color],
  );

  const handlePointerDown = useCallback((e: FederatedPointerEvent) => onDragStart?.(e), [onDragStart]);

  return (
    <pixiGraphics
      draw={draw}
      x={piece.pos.x}
      y={piece.pos.y}
      hitArea={hitArea}
      eventMode={draggable ? 'static' : 'none'}
      cursor="ns-resize"
      onPointerDown={handlePointerDown}
    />
  );
};
