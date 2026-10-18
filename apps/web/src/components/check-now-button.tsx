'use client';

import { useState } from 'react';
import { csrfHeaders } from '../lib/csrf';

export function CheckNowButton({ targetId, disabled }: { targetId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  async function onClick() {
    setMessage(undefined);
    setPending(true);
    try {
      const res = await fetch(`/api/v1/targets/${targetId}/check-now`, {
        method: 'POST',
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        setMessage('Could not queue a check');
        setPending(false);
        return;
      }
      setMessage('Check queued');
      setPending(false);
      window.location.reload();
    } catch {
      setMessage('Could not reach the API');
      setPending(false);
    }
  }

  return (
    <span className="inline-actions">
      <button className="button" type="button" onClick={() => void onClick()} disabled={disabled || pending}>
        {pending ? 'Queuing…' : 'Check now'}
      </button>
      {message ? (
        <span className="muted" role="status" aria-live="polite">
          {message}
        </span>
      ) : null}
    </span>
  );
}
