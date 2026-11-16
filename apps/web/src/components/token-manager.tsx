'use client';

import { useState, type FormEvent } from 'react';
import { csrfHeaders } from '../lib/csrf';
import { RelativeTime } from './relative-time';
import type { PublicApiToken } from '../lib/types';

export function TokenManager({ initialItems }: { initialItems: PublicApiToken[] }) {
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [secret, setSecret] = useState<string | undefined>();
  const [confirmId, setConfirmId] = useState<string | undefined>();

  async function refresh() {
    const res = await fetch('/api/v1/tokens');
    if (!res.ok) return;
    const data = (await res.json()) as { items: PublicApiToken[] };
    setItems(data.items);
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSecret(undefined);
    setPending(true);
    const payload: { label: string; expires_at?: string } = { label };
    if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
    try {
      const res = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: csrfHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? 'Could not create token');
        setPending(false);
        return;
      }
      const created = (await res.json()) as PublicApiToken & { token: string };
      setSecret(created.token);
      setLabel('');
      setExpiresAt('');
      await refresh();
      setPending(false);
    } catch {
      setError('Could not reach the API');
      setPending(false);
    }
  }

  async function onRevoke(id: string) {
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/v1/tokens/${id}`, { method: 'DELETE', headers: csrfHeaders() });
      if (!res.ok && res.status !== 204) {
        setError('Could not revoke this token');
        setPending(false);
        return;
      }
      setConfirmId(undefined);
      setSecret(undefined);
      await refresh();
      setPending(false);
    } catch {
      setError('Could not reach the API');
      setPending(false);
    }
  }

  return (
    <div className="token-manager">
      <form className="form form--wide" onSubmit={onCreate}>
        <label htmlFor="token-label">Label</label>
        <input
          id="token-label"
          name="label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
          maxLength={100}
          autoComplete="off"
        />
        <label htmlFor="token-expires">Expires (optional)</label>
        <input
          id="token-expires"
          name="expires_at"
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button" type="submit" disabled={pending || label.trim().length === 0}>
          {pending ? 'Working…' : 'Create token'}
        </button>
      </form>

      {secret ? (
        <div className="notice" role="status">
          <p>Copy this token now. It will not be shown again.</p>
          <pre className="token-secret" data-testid="token-secret">
            {secret}
          </pre>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="muted" role="status">
          No API tokens yet.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Prefix</th>
                <th scope="col">Created</th>
                <th scope="col">Expires</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.label}</th>
                  <td>
                    <code>{item.prefix}</code>
                  </td>
                  <td>
                    <RelativeTime iso={item.created_at} />
                  </td>
                  <td>{item.expires_at ? <RelativeTime iso={item.expires_at} /> : 'Never'}</td>
                  <td>
                    {confirmId === item.id ? (
                      <div className="inline-actions">
                        <button
                          className="button button--danger"
                          type="button"
                          disabled={pending}
                          onClick={() => void onRevoke(item.id)}
                        >
                          Confirm revoke
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmId(undefined)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        disabled={pending}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
