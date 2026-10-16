import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MainLayout } from './MainLayout';

describe('MainLayout', () => {
  it('renders the title as the page heading', () => {
    render(<MainLayout title="Sectorball">content</MainLayout>);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sectorball');
  });

  it('renders its children inside the main region', () => {
    render(
      <MainLayout title="Sectorball">
        <p>pitch</p>
      </MainLayout>,
    );

    expect(screen.getByRole('main')).toContainElement(screen.getByText('pitch'));
  });
});
