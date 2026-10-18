import { render, screen } from '@testing-library/react';
import { createGame } from '@sectorball/shared';
import type { GameState, PlayerInfo, Team } from '@sectorball/shared';
import { describe, expect, it } from 'vitest';
import { THEME } from '../../constants/theme';
import { Scoreboard } from './Scoreboard';

const base = createGame({ matchId: 'm', firstKickoff: 'home', now: 0 });
const players: Record<Team, PlayerInfo | null> = {
  home: { id: 'p1', nickname: 'Anna' },
  away: { id: 'p2', nickname: 'Béla' },
};

const renderBoard = (overrides: Partial<GameState> = {}, myTeam: Team = 'home', now = 1_000) => {
  const state: GameState = { ...base, ...overrides };
  render(<Scoreboard state={state} players={players} myTeam={myTeam} now={now} />);
};

describe('Scoreboard', () => {
  it('shows nicknames in team colours and the score', () => {
    renderBoard({ score: { home: 2, away: 1 } });
    expect(screen.getByText('2 – 1')).toBeInTheDocument();
    expect(screen.getByText('Anna')).toHaveStyle({ color: THEME.home });
    expect(screen.getByText('Béla')).toHaveStyle({ color: THEME.away });
  });

  it('shows a dash for a missing player', () => {
    const state: GameState = { ...base };
    render(<Scoreboard state={state} players={{ home: players.home, away: null }} myTeam="home" now={0} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the half label and remaining half time', () => {
    renderBoard({ half: 2, halfStartedAt: 0 }, 'home', 1_000);
    expect(screen.getByText(/2\. félidő/)).toHaveTextContent('2. félidő 09:59');
  });

  it('says Te jössz when it is my turn, with the turn clock', () => {
    renderBoard({ turn: 'home', turnStartedAt: 0 }, 'home', 1_000);
    expect(screen.getByText(/Te jössz/)).toHaveTextContent('Te jössz 00:29');
  });

  it('says Az ellenfél jön otherwise', () => {
    renderBoard({ turn: 'away' }, 'home');
    expect(screen.getByText(/Az ellenfél jön/)).toBeInTheDocument();
  });

  it('prompts me to set the keeper during my keeper setup', () => {
    renderBoard({ phase: 'keeperSetup', turn: 'home' }, 'home');
    expect(screen.getByText(/Állítsd be a kapust!/)).toBeInTheDocument();
  });

  it('does not prompt the keeper setup to the opponent', () => {
    renderBoard({ phase: 'keeperSetup', turn: 'away' }, 'home');
    expect(screen.queryByText(/Állítsd be a kapust!/)).not.toBeInTheDocument();
    expect(screen.getByText(/Az ellenfél jön/)).toBeInTheDocument();
  });

  it('shows the end and the winner, hiding turn info', () => {
    renderBoard({ phase: 'finished', winner: 'away' });
    expect(screen.getByText('Vége')).toBeInTheDocument();
    expect(screen.getByText('Győztes: Béla')).toBeInTheDocument();
    expect(screen.queryByText(/Te jössz|Az ellenfél jön/)).not.toBeInTheDocument();
  });

  it('shows Döntetlen for a draw', () => {
    renderBoard({ phase: 'finished', winner: 'draw' });
    expect(screen.getByText('Döntetlen')).toBeInTheDocument();
  });
});
