'use client';

import { useState, type FormEvent } from 'react';

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

export function NewTargetForm() {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      url: String(form.get('url') ?? ''),
      method: String(form.get('method') ?? 'GET'),
    };
    try {
      const res = await fetch('/api/v1/targets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': readCookie('beacon_csrf') ?? '',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? 'Could not create the monitor');
        setPending(false);
        return;
      }
      window.location.assign('/dashboard');
    } catch {
      setError('Could not reach the API');
      setPending(false);
    }
  }

  return (
    <form className="form" method="post" action="#" onSubmit={onSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required maxLength={100} />
      <label htmlFor="url">URL</label>
      <input id="url" name="url" type="url" required placeholder="https://example.com/health" />
      <label htmlFor="method">Method</label>
      <select id="method" name="method" defaultValue="GET">
        <option value="GET">GET</option>
        <option value="HEAD">HEAD</option>
        <option value="POST">POST</option>
      </select>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Create monitor'}
      </button>
    </form>
  );
}
