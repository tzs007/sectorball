import type { GameState, PlayerInfo, Team } from '@sectorball/shared';
import { THEME } from '../../constants/theme';
import { formatClock, halfRemainingMs, turnRemainingMs } from '../../utils/format';

export type ScoreboardProps = {
  readonly state: GameState;
  readonly players: Readonly<Record<Team, PlayerInfo | null>>;
  readonly connected: Readonly<Record<Team, boolean>>;
  readonly myTeam: Team;
  /** Already corrected for client/server clock skew. */
  readonly now: number;
};

const nameOf = (player: PlayerInfo | null): string => player?.nickname ?? '—';

const label = (player: PlayerInfo | null, isConnected: boolean): string =>
  player !== null && !isConnected ? `${nameOf(player)} (nincs csatlakozva)` : nameOf(player);

const turnText = (state: GameState, myTeam: Team): string => {
  if (state.phase === 'keeperSetup' && state.turn === myTeam) return 'Állítsd be a kapust!';
  return state.turn === myTeam ? 'Te jössz' : 'Az ellenfél jön';
};

const resultText = (state: GameState, players: ScoreboardProps['players']): string =>
  state.winner === 'home' || state.winner === 'away' ? `Győztes: ${nameOf(players[state.winner])}` : 'Döntetlen';

export const Scoreboard = ({ state, players, connected, myTeam, now }: ScoreboardProps) => (
  <div className="scoreboard">
    <div className="scoreboard__score">
      <span style={{ color: THEME.home }}>{label(players.home, connected.home)}</span>
      <strong>{`${state.score.home} – ${state.score.away}`}</strong>
      <span style={{ color: THEME.away }}>{label(players.away, connected.away)}</span>
    </div>
    <div className="scoreboard__half">{`${state.half}. félidő ${formatClock(halfRemainingMs(state, now))}`}</div>
    {state.phase === 'finished' ? (
      <div className="scoreboard__turn">
        <span>Vége</span> <span>{resultText(state, players)}</span>
      </div>
    ) : (
      <div className="scoreboard__turn">{`${turnText(state, myTeam)} ${formatClock(turnRemainingMs(state, now))}`}</div>
    )}
  </div>
);
