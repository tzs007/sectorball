import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { canDeclareShot, createGame, FIELD } from '@sectorball/shared';
import type { GameState, PlayerInfo, Team } from '@sectorball/shared';
import { describe, expect, it, vi } from 'vitest';
import { Game } from './Game';

vi.mock('@pixi/react', () => ({
  Application: () => null,
  extend: () => undefined,
  useApplication: () => ({ app: null, isInitialised: false }),
  useTick: () => undefined,
}));
// The scene is never rendered here; stub pixi.js so its import doesn't probe canvas support in jsdom.
vi.mock('pixi.js', () => ({ Circle: vi.fn(), Container: vi.fn(), Graphics: vi.fn(), Rectangle: vi.fn() }));

const base = createGame({ matchId: 'm', firstKickoff: 'home', now: 0 });
const players: Record<Team, PlayerInfo | null> = {
  home: { id: 'p1', nickname: 'Anna' },
  away: { id: 'p2', nickname: 'Béla' },
};
const inAwayHalf = { x: FIELD.width * 0.75, y: FIELD.height / 2 };

const setup = (overrides: Partial<GameState> = {}, myTeam: Team = 'home') => {
  const state: GameState = { ...base, ...overrides };
  const props = {
    onShoot: vi.fn(),
    onDeclareShot: vi.fn(),
    onMoveKeeper: vi.fn(),
    onConfirmKeeper: vi.fn(),
    onReplayEnd: vi.fn(),
  };
  render(<Game state={state} myTeam={myTeam} players={players} replay={null} serverClockOffsetMs={0} {...props} />);
  return { state, ...props };
};

describe('Game', () => {
  it('renders the scoreboard and action bar from props', () => {
    setup({ score: { home: 3, away: 1 } });
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Béla')).toBeInTheDocument();
    expect(screen.getByText('3 – 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kapu!' })).toBeInTheDocument();
  });

  it('enables Kapu! when canDeclareShot allows it', () => {
    const { state } = setup({ ball: inAwayHalf });
    expect(canDeclareShot(state, 'home')).toBe(true);
    expect(screen.getByRole('button', { name: 'Kapu!' })).toBeEnabled();
  });

  it('disables Kapu! when canDeclareShot forbids it', () => {
    const { state } = setup({ ball: inAwayHalf }, 'away');
    expect(canDeclareShot(state, 'away')).toBe(false);
    expect(screen.getByRole('button', { name: 'Kapu!' })).toBeDisabled();
  });

  it('calls onDeclareShot when Kapu! is clicked', async () => {
    const { onDeclareShot } = setup({ ball: inAwayHalf });
    await userEvent.click(screen.getByRole('button', { name: 'Kapu!' }));
    expect(onDeclareShot).toHaveBeenCalledTimes(1);
  });

  it('shows Kapus kész during my keeper setup and calls onConfirmKeeper', async () => {
    const { onConfirmKeeper } = setup({ phase: 'keeperSetup', turn: 'away' }, 'away');
    await userEvent.click(screen.getByRole('button', { name: 'Kapus kész' }));
    expect(onConfirmKeeper).toHaveBeenCalledTimes(1);
  });

  it('hides Kapus kész during the opponent keeper setup', () => {
    setup({ phase: 'keeperSetup', turn: 'away' }, 'home');
    expect(screen.queryByRole('button', { name: 'Kapus kész' })).not.toBeInTheDocument();
  });

  it('shows GÓL! for a goal decision', () => {
    setup({ lastDecision: { kind: 'goal', scorer: 'home', ownGoal: false } });
    expect(screen.getByRole('status')).toHaveTextContent('GÓL!');
  });
});
