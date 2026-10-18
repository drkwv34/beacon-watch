import type { DisplayStatus } from '@beacon-watch/domain';
import { STATUS_BADGE_LABELS } from '../lib/status-labels';

/** Status is always text + color (NFR-A11Y-001): color alone never carries meaning. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span aria-hidden="true" className="badge__dot" />
      {STATUS_BADGE_LABELS[status]}
    </span>
  );
}
