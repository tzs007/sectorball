import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('enables submit once the nickname has 2 characters and submits it', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Belépés' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Becenév'), 'Zs');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith('Zs');
  });

  it('keeps submit disabled when the trimmed nickname is too short', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Becenév'), ' a ');
    expect(screen.getByRole('button', { name: 'Belépés' })).toBeDisabled();
  });

  it('disables submit while busy', async () => {
    render(<LoginForm onSubmit={vi.fn()} busy />);
    await userEvent.type(screen.getByLabelText('Becenév'), 'Zsolt');
    expect(screen.getByRole('button', { name: 'Belépés' })).toBeDisabled();
  });

  it('shows the error', () => {
    render(<LoginForm onSubmit={vi.fn()} error="A becenév 2–20 karakter legyen" />);
    expect(screen.getByText('A becenév 2–20 karakter legyen')).toBeInTheDocument();
  });
});
