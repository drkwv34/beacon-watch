import type { ReactNode } from 'react';
import { StatePanel } from '../../../components/state-panel';
import { requireDashboardSession } from '../../../lib/dashboard-session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireDashboardSession();
  if (!session.ok) {
    return (
      <StatePanel
        tone="danger"
        title="Could not verify session"
        body={`The API returned ${session.status}. Request ${session.requestId}.`}
      />
    );
  }
  return children;
}
