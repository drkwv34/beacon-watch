'use client';

import { useState, type FormEvent } from 'react';

export function AuthForm({
  action,
  submitLabel,
}: {
  action: '/api/v1/auth/login' | '/api/v1/auth/register';
  submitLabel: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    };
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? 'Something went wrong');
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
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
      {error ? (
        <p className="form-error" role="alert" id="auth-error">
          {error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </button>
    </form>
  );
}
