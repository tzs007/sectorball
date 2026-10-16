import type { ReactNode } from 'react';

export type MainLayoutProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export const MainLayout = ({ title, children }: MainLayoutProps) => (
  <div className="layout">
    <header className="layout__header">
      <h1>{title}</h1>
    </header>
    <main className="layout__main">{children}</main>
  </div>
);
