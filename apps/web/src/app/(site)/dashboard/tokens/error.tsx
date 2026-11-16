'use client';

import { StatePanel } from '../../../../components/state-panel';

export default function TokensError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <StatePanel
      tone="danger"
      title="Something went wrong"
      body={error.message || 'API tokens failed to load.'}
      action={
        <button className="button" type="button" onClick={() => reset()}>
          Retry
        </button>
      }
    />
  );
}
