import type { ReactNode } from 'react';

export type ButtonProps = {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly variant?: 'primary' | 'secondary';
  readonly type?: 'button' | 'submit';
};

export const Button = ({ children, onClick, disabled = false, variant = 'primary', type = 'button' }: ButtonProps) => (
  <button type={type} className={`button button--${variant}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);
