import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MatchSummary } from '@sectorball/shared';
import { describe, expect, it, vi } from 'vitest';
import { Lobby } from './Lobby';

const match = (id: string, nickname: string): MatchSummary => ({
  id,
  status: 'open',
  home: { id: `p-${id}`, nickname },
  away: null,
  createdAt: '2026-10-18T10:00:00.000Z',
});

const setup = (matches: MatchSummary[], extra: { busy?: boolean; error?: string | null } = {}) => {
  const onCreate = vi.fn();
  const onJoin = vi.fn();
  render(
    <Lobby
      matches={matches}
      onCreate={onCreate}
      onJoin={onJoin}
      busy={extra.busy ?? false}
      error={extra.error ?? null}
    />,
  );
  return { onCreate, onJoin };
};

describe('Lobby', () => {
  it('shows the empty text when there are no open matches', () => {
    setup([]);
    expect(screen.getByText('Nincs nyitott meccs')).toBeInTheDocument();
  });

  it('lists the host nicknames of the open matches', () => {
    setup([match('m1', 'Anna'), match('m2', 'Béla')]);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Béla')).toBeInTheDocument();
    expect(screen.queryByText('Nincs nyitott meccs')).not.toBeInTheDocument();
  });

  it('joins the clicked match', async () => {
    const { onJoin } = setup([match('m1', 'Anna'), match('m2', 'Béla')]);
    const [, second] = screen.getAllByRole('button', { name: 'Csatlakozás' });
    if (!second) throw new Error('expected two join buttons');
    await userEvent.click(second);
    expect(onJoin).toHaveBeenCalledWith('m2');
  });

  it('creates a match with Új meccs', async () => {
    const { onCreate } = setup([]);
    await userEvent.click(screen.getByRole('button', { name: 'Új meccs' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('disables the buttons while busy', () => {
    setup([match('m1', 'Anna')], { busy: true });
    expect(screen.getByRole('button', { name: 'Új meccs' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Csatlakozás' })).toBeDisabled();
  });

  it('shows the error', () => {
    setup([], { error: 'A meccs már megtelt' });
    expect(screen.getByRole('alert')).toHaveTextContent('A meccs már megtelt');
  });
});
