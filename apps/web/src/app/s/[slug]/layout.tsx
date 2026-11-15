import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { readPublicStatus } from '../../../lib/public-status';

export const dynamic = 'force-dynamic';

export default async function StatusLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const result = await readPublicStatus(slug);
  if (!result.ok && result.reason === 'not_found') notFound();

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
