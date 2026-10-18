import { redirect } from 'next/navigation';
import { LogoutButton } from '../../../components/logout-button';
import { RelativeTime } from '../../../components/relative-time';
import { StatePanel } from '../../../components/state-panel';
import { StatusBadge } from '../../../components/status-badge';
import { formatLatency } from '../../../lib/format';
import { apiFetch } from '../../../lib/session';
import type { PublicTarget } from '../../../lib/types';

export const dynamic = 'force-dynamic';

interface TargetList {
  items: PublicTarget[];
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
            Add your first monitor.
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
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Latency</th>
              <th scope="col">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((target) => (
              <tr key={target.id}>
                <th scope="row">
                  <a href={`/dashboard/targets/${target.id}`}>{target.name}</a>
                  <div className="muted url-line">{target.url}</div>
                </th>
                <td>
                  <StatusBadge status={target.last_status} />
                </td>
                <td className="numeric">{formatLatency(target.latency_ms)}</td>
                <td>
                  <RelativeTime iso={target.last_checked_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="target-cards">
        {data.items.map((target) => (
          <li key={target.id}>
            <a href={`/dashboard/targets/${target.id}`}>
              <strong>{target.name}</strong>
            </a>
            <span className="muted url-line">{target.url}</span>
            <StatusBadge status={target.last_status} />
            <span className="numeric">{formatLatency(target.latency_ms)}</span>
            <RelativeTime iso={target.last_checked_at} />
          </li>
        ))}
      </ul>
    </>
  );
}
