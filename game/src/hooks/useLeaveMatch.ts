import type { MatchStatus } from '@sectorball/shared';
import type { ApiClient } from '../services/apiClient';

export type LeaveMatchOptions = {
  readonly token: string;
  readonly matchId: string;
  readonly status: MatchStatus | null;
  readonly api: ApiClient;
  readonly onLeave: () => void;
};

/** Returns the `Kilépés` handler: cancels an open match, confirms before leaving a live one. */
export const useLeaveMatch = ({ token, matchId, status, api, onLeave }: LeaveMatchOptions) => () => {
  if (status === 'open') {
    // leave even when the cancel fails: the host must not be stuck on the waiting screen
    api.cancelMatch(token, matchId).then(onLeave, onLeave);
    return;
  }
  if (status === 'live' && !window.confirm('Biztosan kilépsz a meccsből?')) return;
  onLeave();
};
