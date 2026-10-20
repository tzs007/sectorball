import type { MatchSummary } from '@sectorball/shared';
import { Button } from '../atoms/Button';

export type MatchListItemProps = {
  readonly match: MatchSummary;
  readonly onJoin: (id: string) => void;
  readonly disabled?: boolean;
};

export const MatchListItem = ({ match, onJoin, disabled = false }: MatchListItemProps) => (
  <li className="match-list-item">
    <span className="match-list-item__host">{match.home.nickname}</span>
    <Button
      onClick={() => {
        onJoin(match.id);
      }}
      disabled={disabled}
    >
      Csatlakozás
    </Button>
  </li>
);
