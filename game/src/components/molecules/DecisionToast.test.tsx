import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionToast } from './DecisionToast';

describe('DecisionToast', () => {
  it('renders the text as a status', () => {
    render(<DecisionToast text="GÓL!" />);
    expect(screen.getByRole('status')).toHaveTextContent('GÓL!');
  });

  it('renders nothing when text is null', () => {
    render(<DecisionToast text={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
