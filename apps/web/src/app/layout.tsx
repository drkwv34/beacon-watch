import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'beacon-watch',
  description:
    'Uptime and latency monitoring with incident timelines, cached status pages, and a rate-limited public API.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <span className="brand">beacon-watch</span>
        </header>
        <main id="main" className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
