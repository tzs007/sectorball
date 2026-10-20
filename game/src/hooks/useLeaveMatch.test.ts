import { act, renderHook } from '@testing-library/react';
import type { MatchStatus } from '@sectorball/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../services/apiClient';
import { useLeaveMatch } from './useLeaveMatch';

const setup = (status: MatchStatus | null, cancelMatch = vi.fn().mockResolvedValue(undefined)) => {
  const api = { cancelMatch } as unknown as ApiClient;
  const onLeave = vi.fn();
  const { result } = renderHook(() => useLeaveMatch({ token: 't', matchId: 'm1', status, api, onLeave }));
  return { cancelMatch, onLeave, leave: result.current };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLeaveMatch', () => {
  it('cancels an open match and then returns to the lobby', async () => {
    const { cancelMatch, onLeave, leave } = setup('open');
    await act(async () => {
      leave();
      await Promise.resolve();
    });
    expect(cancelMatch).toHaveBeenCalledExactlyOnceWith('t', 'm1');
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('does not leave an open match before the cancel resolves', () => {
    const { onLeave, leave } = setup('open', vi.fn(() => new Promise<void>(() => undefined)));
    act(() => { leave(); });
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('still returns to the lobby when cancelling fails', async () => {
    const { onLeave, leave } = setup('open', vi.fn().mockRejectedValue(new Error('network')));
    await act(async () => {
      leave();
      await Promise.resolve();
    });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before leaving a live match', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { cancelMatch, onLeave, leave } = setup('live');
    act(() => { leave(); });
    expect(confirm).toHaveBeenCalledExactlyOnceWith('Biztosan kilépsz a meccsből?');
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(cancelMatch).not.toHaveBeenCalled();
  });

  it('stays in a live match when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onLeave, leave } = setup('live');
    act(() => { leave(); });
    expect(onLeave).not.toHaveBeenCalled();
  });

  it.each([null, 'finished', 'abandoned'] as const)('leaves without asking when the status is %s', (status) => {
    const confirm = vi.spyOn(window, 'confirm');
    const { cancelMatch, onLeave, leave } = setup(status);
    act(() => { leave(); });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancelMatch).not.toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
