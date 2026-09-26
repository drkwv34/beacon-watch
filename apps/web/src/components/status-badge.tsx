import type { DisplayStatus } from '@beacon-watch/domain';

const LABELS: Record<DisplayStatus, string> = {
  up: 'Up',
  down: 'Down',
  unknown: 'Unknown',
  paused: 'Paused',
};

/** Status is always text + color (NFR-A11Y-001): color alone never carries meaning. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span aria-hidden="true" className="badge__dot" />
      {LABELS[status]}
    </span>
  );
}
