import type { MatchSummary } from '@sectorball/shared';
import { Button } from '../atoms/Button';
import { MatchListItem } from '../molecules/MatchListItem';

export type LobbyProps = {
  readonly matches: readonly MatchSummary[];
  readonly onCreate: () => void;
  readonly onJoin: (id: string) => void;
  readonly busy: boolean;
  readonly error: string | null;
};

export const Lobby = ({ matches, onCreate, onJoin, busy, error }: LobbyProps) => (
  <section className="lobby">
    <Button onClick={onCreate} disabled={busy}>
      Új meccs
    </Button>
    {error !== null && (
      <p className="lobby__error" role="alert">
        {error}
      </p>
    )}
    {matches.length === 0 ? (
      <p className="lobby__empty">Nincs nyitott meccs</p>
    ) : (
      <ul className="lobby__list">
        {matches.map((match) => (
          <MatchListItem key={match.id} match={match} onJoin={onJoin} disabled={busy} />
        ))}
      </ul>
    )}
  </section>
);
