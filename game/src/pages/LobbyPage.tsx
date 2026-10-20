import type { MatchView } from '@sectorball/shared';
import { Button } from '../components/atoms/Button';
import { Lobby } from '../components/organisms/Lobby';
import { MainLayout } from '../components/templates/MainLayout';
import { useLobby } from '../hooks/useLobby';
import type { Session } from '../hooks/useSession';
import type { ApiClient } from '../services/apiClient';

const errorText = (code: string | null): string | null => {
  if (code === null) return null;
  return code === 'matchFull' ? 'A meccs már megtelt' : 'Hiba történt, próbáld újra';
};

export type LobbyPageProps = {
  readonly session: Session;
  readonly api: ApiClient;
  readonly onEnterMatch: (id: string) => void;
  readonly onLogout: () => void;
};

export const LobbyPage = ({ session, api, onEnterMatch, onLogout }: LobbyPageProps) => {
  const { matches, create, join, busy, error } = useLobby(session.token, api);
  // the player's own open match is re-entered with Új meccs (idempotent), not joined
  const joinable = matches.filter((match) => match.home.id !== session.player.id);

  const enter = (action: Promise<MatchView>) => {
    action.then(
      (view) => {
        onEnterMatch(view.id);
      },
      () => undefined, // the error is already shown by useLobby
    );
  };

  return (
    <MainLayout title="Sectorball">
      <div className="lobby-page__bar">
        <span>{session.player.nickname}</span>
        <Button variant="secondary" onClick={onLogout}>
          Kilépés
        </Button>
      </div>
      <Lobby
        matches={joinable}
        onCreate={() => {
          enter(create());
        }}
        onJoin={(id) => {
          enter(join(id));
        }}
        busy={busy}
        error={errorText(error)}
      />
    </MainLayout>
  );
};
