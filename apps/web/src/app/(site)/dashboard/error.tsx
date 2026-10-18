'use client';

import { StatePanel } from '../../../components/state-panel';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <StatePanel
      tone="danger"
      title="Something went wrong"
      body={error.message || 'The dashboard failed to load.'}
      action={
        <button className="button" type="button" onClick={() => reset()}>
          Retry
        </button>
      }
    />
  );
}
