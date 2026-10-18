import { Application, extend } from '@pixi/react';
import { canDeclareShot } from '@sectorball/shared';
import type { GameState, PieceId, PlayerInfo, Replay, Team, Vec } from '@sectorball/shared';
import { Container, Graphics } from 'pixi.js';
import { useRef } from 'react';
import { THEME } from '../../constants/theme';
import { useNow } from '../../hooks/useNow';
import { decisionText } from '../../utils/decisionText';
import { ActionBar } from '../molecules/ActionBar';
import { DecisionToast } from '../molecules/DecisionToast';
import { Scoreboard } from '../molecules/Scoreboard';
import { GameScene } from './GameScene';

extend({ Container, Graphics });

export type GameProps = {
  readonly state: GameState;
  readonly myTeam: Team;
  readonly players: Readonly<Record<Team, PlayerInfo | null>>;
  readonly replay: Replay | null;
  /** Server clock minus client clock (ms), used to correct the countdowns. */
  readonly serverClockOffsetMs: number;
  readonly onShoot: (pieceId: PieceId, pull: Vec) => void;
  readonly onDeclareShot: () => void;
  readonly onMoveKeeper: (y: number) => void;
  readonly onConfirmKeeper: () => void;
  readonly onReplayEnd: () => void;
};

/** Presentational match screen: HUD plus the Pixi scene; all game I/O goes through props. */
export const Game = ({
  state,
  myTeam,
  players,
  replay,
  serverClockOffsetMs,
  onShoot,
  onDeclareShot,
  onMoveKeeper,
  onConfirmKeeper,
  onReplayEnd,
}: GameProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const now = useNow() + serverClockOffsetMs;

  return (
    <div className="game">
      <Scoreboard state={state} players={players} myTeam={myTeam} now={now} />
      <div ref={canvasRef} className="game__canvas">
        <Application resizeTo={canvasRef} background={THEME.pitch} antialias>
          <GameScene
            state={state}
            myTeam={myTeam}
            replay={replay}
            onShoot={onShoot}
            onMoveKeeper={onMoveKeeper}
            onReplayEnd={onReplayEnd}
          />
        </Application>
      </div>
      <ActionBar
        canDeclareShot={replay === null && canDeclareShot(state, myTeam)}
        keeperSetup={replay === null && state.phase === 'keeperSetup' && state.turn === myTeam}
        onDeclareShot={onDeclareShot}
        onConfirmKeeper={onConfirmKeeper}
      />
      <DecisionToast text={decisionText(state.lastDecision, myTeam)} />
    </div>
  );
};
