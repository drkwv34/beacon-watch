import { notFound, redirect } from 'next/navigation';
import { CheckNowButton } from '../../../../../components/check-now-button';
import { DeleteTargetButton } from '../../../../../components/delete-target-button';
import { RelativeTime } from '../../../../../components/relative-time';
import { StatePanel } from '../../../../../components/state-panel';
import { StatusBadge } from '../../../../../components/status-badge';
import { TargetForm } from '../../../../../components/target-form';
import { formatDuration, formatLatency } from '../../../../../lib/format';
import { apiFetch } from '../../../../../lib/session';
import type { PublicCheck, PublicIncident, PublicTarget } from '../../../../../lib/types';

export const dynamic = 'force-dynamic';

async function loadJson<T>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; requestId: string }> {
  const res = await apiFetch(path);
  if (res.status === 401) redirect('/login');
  if (res.status === 404) notFound();
  if (!res.ok) {
    return { ok: false, status: res.status, requestId: res.headers.get('x-request-id') ?? 'unknown' };
  }
  return { ok: true, data: (await res.json()) as T };
}

export default async function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const targetRes = await loadJson<PublicTarget>(`/api/v1/targets/${id}`);
  if (!targetRes.ok) {
    return (
      <StatePanel
        tone="danger"
        title="Could not load monitor"
        body={`The API returned ${targetRes.status}. Request ${targetRes.requestId}.`}
      />
    );
  }
  const target = targetRes.data;
  const [checksRes, incidentsRes] = await Promise.all([
    loadJson<{ items: PublicCheck[] }>(`/api/v1/targets/${id}/checks?limit=50`),
    loadJson<{ items: PublicIncident[] }>(`/api/v1/targets/${id}/incidents`),
  ]);
  const checks = checksRes.ok ? checksRes.data.items : [];
  const incidents = incidentsRes.ok ? incidentsRes.data.items : [];
  const everSucceeded = checks.some((check) => check.success);

  return (
    <>
      <p>
        <a href="/dashboard">Back to monitors</a>
      </p>
      <header className="detail-header">
        <div>
          <h1>{target.name}</h1>
          <p className="muted url-line">{target.url}</p>
        </div>
        <div className="detail-header__status">
          <StatusBadge status={target.last_status} />
          <span className="numeric">{formatLatency(target.latency_ms)}</span>
          <span>
            Last checked <RelativeTime iso={target.last_checked_at} />
          </span>
          <CheckNowButton targetId={target.id} disabled={!target.enabled} />
        </div>
      </header>
      {target.is_public && target.public_slug ? (
        <p>
          Public page:{' '}
          <a href={`/s/${target.public_slug}`} target="_blank" rel="noreferrer">
            /s/{target.public_slug}
          </a>
        </p>
      ) : null}
      {!target.last_checked_at ? (
        <p className="notice" role="status">
          Monitoring starting…
        </p>
      ) : null}
      {target.last_checked_at && !everSucceeded ? (
        <p className="notice" role="status">
          No successful checks yet.
        </p>
      ) : null}

      <section>
        <h2>Recent checks</h2>
        {checks.length === 0 ? (
          <p className="muted">No checks recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Status code</th>
                  <th scope="col">Latency</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id}>
                    <td>
                      <RelativeTime iso={check.checked_at} />
                    </td>
                    <td className="numeric">{check.status_code ?? '—'}</td>
                    <td className="numeric">{formatLatency(check.latency_ms)}</td>
                    <td>{check.success ? 'Success' : (check.error_message ?? check.error_code ?? 'Error')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Incidents</h2>
        {incidents.length === 0 ? (
          <p className="muted">No incidents yet.</p>
        ) : (
          <ol className="timeline">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className={incident.status === 'open' ? 'timeline__item timeline__item--open' : 'timeline__item'}
              >
                <strong>{incident.status === 'open' ? 'Open' : 'Resolved'}</strong>
                <span>
                  opened <RelativeTime iso={incident.opened_at} />
                </span>
                {incident.resolved_at ? (
                  <span>
                    resolved <RelativeTime iso={incident.resolved_at} />
                  </span>
                ) : (
                  <span>still open</span>
                )}
                <span>duration {formatDuration(incident.duration_seconds)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>Edit monitor</h2>
        <TargetForm mode="edit" target={target} />
        <div className="danger-zone">
          <h3>Delete</h3>
          <DeleteTargetButton targetId={target.id} name={target.name} />
        </div>
      </section>
    </>
  );
}
