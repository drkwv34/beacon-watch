import { redirect } from 'next/navigation';
import { TokenManager } from '../../../../components/token-manager';
import { StatePanel } from '../../../../components/state-panel';
import { apiFetch } from '../../../../lib/session';
import type { PublicApiToken } from '../../../../lib/types';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const res = await apiFetch('/api/v1/tokens');
  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    return (
      <StatePanel
        tone="danger"
        title="Could not load API tokens"
        body={`The API returned ${res.status}. Request ${res.headers.get('x-request-id') ?? 'unknown'}.`}
      />
    );
  }
  const data = (await res.json()) as { items: PublicApiToken[] };
  return (
    <>
      <div className="page-head">
        <h1>API tokens</h1>
        <a href="/dashboard">Back to monitors</a>
      </div>
      <p className="muted">
        Tokens authenticate the owner APIs as <code>Authorization: Bearer</code>. The secret is shown once.
      </p>
      <TokenManager initialItems={data.items} />
    </>
  );
}
