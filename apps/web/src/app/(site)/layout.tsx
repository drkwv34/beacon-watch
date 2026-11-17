import type { ReactNode } from 'react';
import { LogoutButton } from '../../components/logout-button';
import { loadDashboardSession } from '../../lib/dashboard-session';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const session = await loadDashboardSession();
  const user = session.state === 'authenticated' ? session.user : undefined;
  const unavailable = session.state === 'unavailable';

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          beacon-watch
        </a>
        <nav className="nav" aria-label="Main">
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/tokens">API tokens</a>
          {user ? (
            <>
              <span className="nav-email">{user.email}</span>
              <LogoutButton />
            </>
          ) : unavailable ? (
            <span className="nav-email">Session unavailable</span>
          ) : (
            <a href="/login">Sign in</a>
          )}
        </nav>
      </header>
      <main id="main" className="container">
        {children}
      </main>
    </>
  );
}
