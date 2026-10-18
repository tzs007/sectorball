import { useApplication } from '@pixi/react';
import { canShoot, clampKeeperY, FIELD } from '@sectorball/shared';
import type { GameState, Piece, PieceId, Replay, Team, Vec } from '@sectorball/shared';
import { Rectangle } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAimDrag } from '../../hooks/useAimDrag';
import { useReplayPlayback } from '../../hooks/useReplayPlayback';
import { throttle } from '../../utils/throttle';
import type { Throttled } from '../../utils/throttle';
import { fitToView, toWorld } from '../../utils/viewport';
import type { Fit } from '../../utils/viewport';
import { AimArrow } from '../atoms/AimArrow';
import { Ball } from '../atoms/Ball';
import { ButtonPiece } from '../atoms/ButtonPiece';
import { KeeperPiece } from '../atoms/KeeperPiece';
import { Pitch } from '../molecules/Pitch';

export type GameSceneProps = {
  readonly state: GameState;
  readonly myTeam: Team;
  readonly replay: Replay | null;
  readonly onShoot: (pieceId: PieceId, pull: Vec) => void;
  readonly onMoveKeeper: (y: number) => void;
  readonly onReplayEnd: () => void;
};

const KEEPER_EMIT_MS = 100;

/** `grabOffsetY` = pointer.y − keeper.y at drag start, so the keeper doesn't jump to the pointer. */
type Drag =
  | { readonly pointerId: number; readonly kind: 'aim' }
  | { readonly pointerId: number; readonly kind: 'keeper'; readonly grabOffsetY: number };

type View = { readonly fit: Fit; readonly hitArea: Rectangle };

/** Fit plus a hit area (in the root's local, scaled space) covering the whole canvas; null while the canvas is 0-sized. */
const viewOf = (width: number, height: number): View | null => {
  if (width <= 0 || height <= 0) return null;
  const fit = fitToView(width, height);
  return {
    fit,
    hitArea: new Rectangle(-fit.x / fit.scale, -fit.y / fit.scale, width / fit.scale, height / fit.scale),
  };
};

const posFrom = (frame: Replay['frames'][number] | undefined, id: string, fallback: Vec): Vec => {
  const p = frame?.[id];
  return p ? { x: p[0], y: p[1] } : fallback;
};

/** Pixi scene: pitch, pieces, slingshot aiming, keeper drag and replay playback. Must render inside `<Application>`. */
export const GameScene = ({ state, myTeam, replay, onShoot, onMoveKeeper, onReplayEnd }: GameSceneProps) => {
  const { app } = useApplication();

  // --- viewport ---
  const [view, setView] = useState<View | null>(() => viewOf(app.screen.width, app.screen.height));
  useEffect(() => {
    const update = () => {
      setView(viewOf(app.screen.width, app.screen.height));
    };
    update();
    app.renderer.on('resize', update);
    return () => {
      app.renderer.off('resize', update);
    };
  }, [app]);

  // --- latest callbacks ---
  const onMoveKeeperRef = useRef(onMoveKeeper);
  useLayoutEffect(() => {
    onMoveKeeperRef.current = onMoveKeeper;
  }, [onMoveKeeper]);

  // --- replay playback ---
  const frameIndex = useReplayPlayback(replay, onReplayEnd);
  const frame = replay?.frames[frameIndex];

  // --- input ---
  const { aim, start, move, end, cancel } = useAimDrag(onShoot);
  // Source of truth for the active drag, so back-to-back pointer events never see stale render state.
  // Only the pointer that started a drag may move or end it.
  const dragRef = useRef<Drag | null>(null);
  const [keeperDrag, setKeeperDrag] = useState<{ y: number } | null>(null);
  // One throttled emitter per mount; pending emissions are dropped on unmount.
  const throttledRef = useRef<Throttled<number> | null>(null);
  useEffect(() => {
    const t = throttle((y: number) => {
      onMoveKeeperRef.current(y);
    }, KEEPER_EMIT_MS);
    throttledRef.current = t;
    return () => {
      t.cancel();
      throttledRef.current = null;
    };
  }, []);

  const inputEnabled = replay === null && view !== null;
  const keeperDraggable = inputEnabled && state.phase === 'keeperSetup' && state.turn === myTeam;
  const aimAllowed = aim !== null && inputEnabled && canShoot(state, myTeam, aim.pieceId);

  // Drop the local keeper preview once my keeper setup is over (adjusting state during render).
  if (!keeperDraggable && keeperDrag !== null) setKeeperDrag(null);

  // Never leave a stuck arrow when the aim stops being allowed (replay, turn change, canvas collapsed).
  useEffect(() => {
    if (aim !== null && !aimAllowed) {
      dragRef.current = null;
      cancel();
    }
  }, [aim, aimAllowed, cancel]);

  // End a keeper drag when my keeper setup ends mid-drag (e.g. server deadline); drop pending emissions.
  useEffect(() => {
    if (!keeperDraggable && dragRef.current?.kind === 'keeper') {
      dragRef.current = null;
      throttledRef.current?.cancel();
    }
  }, [keeperDraggable]);

  const handleAimStart = useCallback(
    (pieceId: PieceId, e: FederatedPointerEvent) => {
      if (!view || dragRef.current !== null || !inputEnabled || !canShoot(state, myTeam, pieceId)) return;
      const piece = state.pieces.find((p) => p.id === pieceId);
      if (!piece) return;
      dragRef.current = { pointerId: e.pointerId, kind: 'aim' };
      start(pieceId, piece.pos, toWorld(e.global, view.fit));
    },
    [view, inputEnabled, state, myTeam, start],
  );

  const handleKeeperDragStart = useCallback(
    (e: FederatedPointerEvent) => {
      if (!view || dragRef.current !== null || !keeperDraggable) return;
      const keeper = state.pieces.find((p) => p.kind === 'keeper' && p.team === myTeam);
      if (!keeper) return;
      const keeperY = keeperDrag?.y ?? keeper.pos.y;
      dragRef.current = { pointerId: e.pointerId, kind: 'keeper', grabOffsetY: toWorld(e.global, view.fit).y - keeperY };
      setKeeperDrag({ y: keeperY });
    },
    [view, keeperDraggable, state.pieces, myTeam, keeperDrag],
  );

  const handleMove = useCallback(
    (e: FederatedPointerEvent) => {
      const drag = dragRef.current;
      if (!view || drag?.pointerId !== e.pointerId) return;
      const world = toWorld(e.global, view.fit);
      if (drag.kind === 'aim') {
        move(world);
      } else if (keeperDraggable) {
        const y = clampKeeperY(world.y - drag.grabOffsetY);
        setKeeperDrag({ y });
        throttledRef.current?.call(y);
      }
    },
    [view, move, keeperDraggable],
  );

  const finish = useCallback(
    (e: FederatedPointerEvent, shoot: boolean) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (drag.kind === 'aim') {
        if (shoot) end();
        else cancel();
      } else if (keeperDraggable) {
        throttledRef.current?.flush();
      } else {
        throttledRef.current?.cancel();
      }
    },
    [end, cancel, keeperDraggable],
  );
  // Releasing off-canvas still shoots (full-power shots near the touchlines need it); only a cancel aborts.
  const handleUp = useCallback((e: FederatedPointerEvent) => { finish(e, true); }, [finish]);
  const handleCancel = useCallback((e: FederatedPointerEvent) => { finish(e, false); }, [finish]);

  // --- render ---
  const buttons = useMemo(() => state.pieces.filter((p) => p.kind === 'button'), [state.pieces]);
  const keepers = useMemo(() => state.pieces.filter((p) => p.kind === 'keeper'), [state.pieces]);

  if (!view) return null;

  const keeperOf = (k: Piece): Piece =>
    k.team === myTeam && keeperDrag !== null ? { ...k, pos: { x: k.pos.x, y: keeperDrag.y } } : k;

  return (
    <pixiContainer
      x={view.fit.x}
      y={view.fit.y}
      scale={view.fit.scale}
      eventMode="static"
      hitArea={view.hitArea}
      onGlobalPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerUpOutside={handleUp}
      onPointerCancel={handleCancel}
    >
      <pixiContainer x={FIELD.margin} y={FIELD.margin}>
        <Pitch />
        {keepers.map((k) => (
          <KeeperPiece
            key={k.id}
            piece={keeperOf(k)}
            draggable={keeperDraggable && k.team === myTeam}
            onDragStart={handleKeeperDragStart}
          />
        ))}
        {buttons.map((b) => (
          <ButtonPiece
            key={b.id}
            piece={frame ? { ...b, pos: posFrom(frame, b.id, b.pos) } : b}
            selectable={inputEnabled && canShoot(state, myTeam, b.id)}
            selected={aim?.pieceId === b.id}
            onAimStart={handleAimStart}
          />
        ))}
        <Ball pos={posFrom(frame, 'ball', state.ball)} />
        {aim && <AimArrow from={aim.from} pull={aim.pull} />}
      </pixiContainer>
    </pixiContainer>
  );
};
