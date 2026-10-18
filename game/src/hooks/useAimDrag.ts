import { length, sub, SHOT } from '@sectorball/shared';
import type { PieceId, Vec } from '@sectorball/shared';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type Aim = { readonly pieceId: PieceId; readonly from: Vec; readonly pull: Vec };

export type AimDrag = {
  readonly aim: Aim | null;
  readonly start: (id: PieceId, from: Vec, pointer: Vec) => void;
  readonly move: (pointer: Vec) => void;
  readonly end: () => void;
  readonly cancel: () => void;
};

/** Slingshot drag state in pitch units: pull = pointer − piece; release with |pull| ≥ SHOT.minPull shoots. */
export const useAimDrag = (onShoot: (id: PieceId, pull: Vec) => void): AimDrag => {
  const [aim, setAim] = useState<Aim | null>(null);
  // The ref is the source of truth so back-to-back pointer events never see a stale aim.
  const aimRef = useRef<Aim | null>(null);
  const onShootRef = useRef(onShoot);

  useLayoutEffect(() => {
    onShootRef.current = onShoot;
  }, [onShoot]);

  const update = useCallback((next: Aim | null) => {
    aimRef.current = next;
    setAim(next);
  }, []);

  const start = useCallback(
    (pieceId: PieceId, from: Vec, pointer: Vec) => { update({ pieceId, from, pull: sub(pointer, from) }); },
    [update],
  );

  const move = useCallback(
    (pointer: Vec) => {
      const current = aimRef.current;
      if (current) update({ ...current, pull: sub(pointer, current.from) });
    },
    [update],
  );

  const cancel = useCallback(() => { update(null); }, [update]);

  const end = useCallback(() => {
    const current = aimRef.current;
    update(null);
    if (current && length(current.pull) >= SHOT.minPull) onShootRef.current(current.pieceId, current.pull);
  }, [update]);

  return { aim, start, move, end, cancel };
};
