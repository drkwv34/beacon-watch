import { StatePanel } from '../../../../../components/state-panel';
import { TargetForm } from '../../../../../components/target-form';
import { requireDashboardSession } from '../../../../../lib/dashboard-session';

export const dynamic = 'force-dynamic';

export default async function NewTargetPage() {
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

  return (
    <>
      <h1>Add a monitor</h1>
      <p>
        <a href="/dashboard">Back to monitors</a>
      </p>
      <TargetForm mode="create" />
    </>
  );
}
