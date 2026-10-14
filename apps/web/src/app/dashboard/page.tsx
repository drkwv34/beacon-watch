import { redirect } from 'next/navigation';
import { LogoutButton } from '../../components/logout-button';
import { StatePanel } from '../../components/state-panel';
import { apiFetch } from '../../lib/session';

interface TargetList {
  items: Array<{ id: string; name: string; url: string; enabled: boolean; last_status: string }>;
}

export default async function DashboardPage() {
  const res = await apiFetch('/api/v1/targets');
  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    return (
      <StatePanel
        tone="danger"
        title="Could not load monitors"
        body={`The API returned ${res.status}. Request ${res.headers.get('x-request-id') ?? 'unknown'}.`}
      />
    );
  }
  const data = (await res.json()) as TargetList;
  if (data.items.length === 0) {
    return (
      <StatePanel
        title="Add your first monitor."
        body="Create an HTTP check to start watching a URL."
        action={
          <a className="button" href="/dashboard/targets/new">
            Add monitor
          </a>
        }
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Monitors</h1>
        <div className="page-head__actions">
          <a className="button" href="/dashboard/targets/new">
            Add monitor
          </a>
          <LogoutButton />
        </div>
      </div>
      <ul className="target-list">
        {data.items.map((target) => (
          <li key={target.id}>
            <strong>{target.name}</strong>
            <span>{target.url}</span>
            <span>{target.enabled ? target.last_status : 'paused'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
