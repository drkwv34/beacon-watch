import { notFound } from 'next/navigation';
import { RelativeTime } from '../../../components/relative-time';
import { StatePanel } from '../../../components/state-panel';
import { StatusBadge } from '../../../components/status-badge';
import { formatDuration, formatUptime } from '../../../lib/format';
import { apiFetch } from '../../../lib/session';
import { PUBLIC_STATUS_NOTICE, selectPublicStatusNotice } from '../../../lib/status-labels';
import type { PublicStatusPage } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export default async function PublicStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let res: Response;
  try {
    res = await apiFetch(`/api/public/v1/status/${encodeURIComponent(slug)}`);
  } catch {
    return (
      <StatePanel
        tone="danger"
        title="Status temporarily unavailable"
        body="The status API could not be reached. Try again in a moment."
      />
    );
  }
  if (res.status === 404) notFound();
  if (res.status === 429 || res.status === 503) {
    return (
      <StatePanel
        tone="danger"
        title="Status temporarily unavailable"
        body="The public status API is rate limited or temporarily down. Try again shortly."
      />
    );
  }
  if (!res.ok) {
    return (
      <StatePanel
        tone="danger"
        title="Status temporarily unavailable"
        body={`Could not load this status page (${res.status}). Request ${res.headers.get('x-request-id') ?? 'unknown'}.`}
      />
    );
  }
  const data = (await res.json()) as PublicStatusPage;
  const notice = selectPublicStatusNotice({
    status: data.status,
    check_count: data.check_count,
    ever_succeeded: data.ever_succeeded,
  });

  return (
    <article className="status-page">
      <h1>{data.name}</h1>
      <p className="status-page__badge">
        <StatusBadge status={data.status} />
      </p>
      {notice ? (
        <p className="notice" role="status">
          {PUBLIC_STATUS_NOTICE[notice]}
        </p>
      ) : null}
      <dl className="status-facts">
        <div>
          <dt>Last 24h uptime</dt>
          <dd className="numeric">{formatUptime(data.uptime_24h)}</dd>
        </div>
        <div>
          <dt>Last checked</dt>
          <dd>
            <RelativeTime iso={data.last_checked_at} />
          </dd>
        </div>
      </dl>
      <section>
        <h2>Recent incidents</h2>
        {data.recent_incidents.length === 0 ? (
          <p className="muted">No incidents recorded.</p>
        ) : (
          <ol className="timeline">
            {data.recent_incidents.map((incident) => (
              <li
                key={`${incident.opened_at}-${incident.status}`}
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
    </article>
  );
}
