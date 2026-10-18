import type { ReactNode } from 'react';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          beacon-watch
        </a>
        <nav className="nav" aria-label="Main">
          <a href="/dashboard">Dashboard</a>
          <a href="/login">Sign in</a>
        </nav>
      </header>
      <main id="main" className="container">
        {children}
      </main>
    </>
  );
}
