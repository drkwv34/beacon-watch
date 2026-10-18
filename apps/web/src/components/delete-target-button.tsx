'use client';

import { useState } from 'react';
import { csrfHeaders } from '../lib/csrf';

export function DeleteTargetButton({ targetId, name }: { targetId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onDelete() {
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/v1/targets/${targetId}`, { method: 'DELETE', headers: csrfHeaders() });
      if (!res.ok && res.status !== 204) {
        setError('Could not delete this monitor');
        setPending(false);
        return;
      }
      window.location.assign('/dashboard');
    } catch {
      setError('Could not reach the API');
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button className="button button--danger" type="button" onClick={() => setConfirming(true)}>
        Delete monitor
      </button>
    );
  }

  return (
    <div className="confirm-box" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-body">
      <p id="delete-title">
        Delete <strong>{name}</strong>? This cannot be undone.
      </p>
      <p id="delete-body" className="muted">
        Checks and incidents for this monitor will be removed.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cta-row">
        <button className="button button--danger" type="button" onClick={() => void onDelete()} disabled={pending}>
          {pending ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button className="button button--ghost" type="button" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
