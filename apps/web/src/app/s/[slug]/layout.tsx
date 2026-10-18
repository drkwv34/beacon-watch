import type { ReactNode } from 'react';

export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          beacon-watch
        </a>
      </header>
      <main id="main" className="container">
        {children}
      </main>
    </>
  );
}
