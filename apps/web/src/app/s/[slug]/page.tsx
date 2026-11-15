import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { RelativeTime } from '../../../components/relative-time';
import { StatePanel } from '../../../components/state-panel';
import { StatusBadge } from '../../../components/status-badge';
import { formatDuration, formatUptime } from '../../../lib/format';
import { readPublicStatus } from '../../../lib/public-status';
import { PUBLIC_STATUS_NOTICE, selectPublicStatusNotice } from '../../../lib/status-labels';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const result = await readPublicStatus(slug);
  if (!result.ok && result.reason === 'not_found') notFound();
  if (result.ok) return { title: `${result.payload.name} · beacon-watch` };
  return { title: 'beacon-watch' };
}

export default async function PublicStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const result = await readPublicStatus(slug);
  if (!result.ok) {
    if (result.reason === 'not_found') notFound();
    return (
      <StatePanel
        tone="danger"
        title="Status temporarily unavailable"
        body="The status page could not be loaded. Try again in a moment."
      />
    );
  }
  const data = result.payload;
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
