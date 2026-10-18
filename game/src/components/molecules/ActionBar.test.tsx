import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from './ActionBar';

const setup = (props: { canDeclareShot: boolean; keeperSetup: boolean }) => {
  const onDeclareShot = vi.fn();
  const onConfirmKeeper = vi.fn();
  render(<ActionBar {...props} onDeclareShot={onDeclareShot} onConfirmKeeper={onConfirmKeeper} />);
  return { onDeclareShot, onConfirmKeeper };
};

describe('ActionBar', () => {
  it('disables Kapu! unless a shot can be declared', () => {
    setup({ canDeclareShot: false, keeperSetup: false });
    expect(screen.getByRole('button', { name: 'Kapu!' })).toBeDisabled();
  });

  it('calls onDeclareShot when enabled Kapu! is clicked', async () => {
    const { onDeclareShot } = setup({ canDeclareShot: true, keeperSetup: false });
    await userEvent.click(screen.getByRole('button', { name: 'Kapu!' }));
    expect(onDeclareShot).toHaveBeenCalledTimes(1);
  });

  it('hides Kapus kész outside keeper setup', () => {
    setup({ canDeclareShot: false, keeperSetup: false });
    expect(screen.queryByRole('button', { name: 'Kapus kész' })).not.toBeInTheDocument();
  });

  it('shows Kapus kész in keeper setup and calls onConfirmKeeper', async () => {
    const { onConfirmKeeper } = setup({ canDeclareShot: false, keeperSetup: true });
    await userEvent.click(screen.getByRole('button', { name: 'Kapus kész' }));
    expect(onConfirmKeeper).toHaveBeenCalledTimes(1);
  });
});
