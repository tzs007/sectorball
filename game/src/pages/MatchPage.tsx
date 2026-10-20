import { teamOf } from '@sectorball/shared';
import { Button } from '../components/atoms/Button';
import { Game } from '../components/organisms/Game';
import { MainLayout } from '../components/templates/MainLayout';
import { useLeaveMatch } from '../hooks/useLeaveMatch';
import { useMatch } from '../hooks/useMatch';
import type { Session } from '../hooks/useSession';
import type { ApiClient } from '../services/apiClient';

export type MatchPageProps = {
  readonly session: Session;
  readonly api: ApiClient;
  readonly matchId: string;
  readonly onLeave: () => void;
};

export const MatchPage = ({ session, api, matchId, onLeave }: MatchPageProps) => {
  const match = useMatch(session.token, matchId);
  const { view, status, replayItem } = match;
  const leave = useLeaveMatch({
    token: session.token,
    matchId,
    status: view?.status ?? null,
    api,
    onLeave,
  });
  const myTeam = view === null ? null : teamOf(view, session.player.id);

  const content = () => {
    if (status === 'gone') return <p className="match-page__message">A meccs megszakadt</p>;
    if (view?.state == null || myTeam === null) {
      return <p className="match-page__message">Várakozás az ellenfélre…</p>;
    }
    return (
      <Game
        // during a replay `view` still holds the state before the shot
        state={view.state}
        myTeam={myTeam}
        players={{ home: view.home, away: view.away }}
        connected={view.connected}
        replay={replayItem?.replay ?? null}
        serverClockOffsetMs={match.serverClockOffsetMs}
        onShoot={match.shoot}
        onDeclareShot={match.declareShot}
        onMoveKeeper={match.moveKeeper}
        onConfirmKeeper={match.confirmKeeper}
        onReplayEnd={match.finishReplay}
      />
    );
  };

  return (
    <MainLayout title="Sectorball">
      <div className="match-page">
        <div className="match-page__bar">
          <Button variant="secondary" onClick={leave}>
            Kilépés
          </Button>
          {match.error !== null && (
            <p className="match-page__error" role="alert">
              Hiba történt, próbáld újra
            </p>
          )}
        </div>
        <div className="match-page__content">{content()}</div>
      </div>
    </MainLayout>
  );
};
