import { PIECE } from '@sectorball/shared';
import type { Piece, PieceId } from '@sectorball/shared';
import { Circle } from 'pixi.js';
import type { FederatedPointerEvent, Graphics } from 'pixi.js';
import { useCallback, useMemo } from 'react';
import { THEME } from '../../constants/theme';

export type ButtonPieceProps = {
  readonly piece: Piece;
  readonly selectable: boolean;
  readonly selected: boolean;
  readonly onAimStart?: (pieceId: PieceId, e: FederatedPointerEvent) => void;
};

const RING_GAP = 3;

/** Placeholder button: flat team-coloured circle plus a separate selection ring overlay. */
export const ButtonPiece = ({ piece, selectable, selected, onAimStart }: ButtonPieceProps) => {
  const hitArea = useMemo(() => new Circle(0, 0, PIECE.buttonRadius), []);
  const color = THEME[piece.team];

  const drawBody = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, PIECE.buttonRadius).fill(color);
    },
    [color],
  );

  const drawRing = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, PIECE.buttonRadius + RING_GAP).stroke({ width: selected ? 4 : 2, color: THEME.highlight });
    },
    [selected],
  );

  const handlePointerDown = useCallback(
    (e: FederatedPointerEvent) => onAimStart?.(piece.id, e),
    [onAimStart, piece.id],
  );

  return (
    <pixiContainer
      x={piece.pos.x}
      y={piece.pos.y}
      hitArea={hitArea}
      eventMode={selectable ? 'static' : 'none'}
      cursor="grab"
      onPointerDown={handlePointerDown}
    >
      <pixiGraphics draw={drawBody} eventMode="none" />
      {selectable && <pixiGraphics draw={drawRing} eventMode="none" />}
    </pixiContainer>
  );
};
