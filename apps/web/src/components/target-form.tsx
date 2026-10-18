'use client';

import { useState, type FormEvent } from 'react';
import { fieldErrorsFromApi, firstInvalidField } from '../lib/api-errors';
import { csrfHeaders } from '../lib/csrf';
import type { PublicTarget } from '../lib/types';

const FIELD_ORDER = [
  'name',
  'url',
  'method',
  'interval_seconds',
  'timeout_ms',
  'expected_status',
  'grace_threshold',
  'recovery_threshold',
  'headers',
  'body',
  'public_slug',
];

function parseHeaders(raw: string): Record<string, string> | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('headers must be a JSON object');
    }
    return parsed as Record<string, string>;
  } catch {
    return undefined;
  }
}

export function TargetForm({ mode, target }: { mode: 'create' | 'edit'; target?: PublicTarget }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState(target?.method ?? 'GET');
  const [isPublic, setIsPublic] = useState(target?.is_public ?? false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFields({});
    setFormError(undefined);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const headersRaw = String(form.get('headers') ?? '');
    const headers = parseHeaders(headersRaw);
    if (headers === undefined) {
      setFields({ headers: 'must be a JSON object of string values' });
      document.getElementById('headers')?.focus();
      return;
    }
    const payload: Record<string, unknown> = {
      name: String(form.get('name') ?? ''),
      url: String(form.get('url') ?? ''),
      method: String(form.get('method') ?? 'GET'),
      interval_seconds: Number(form.get('interval_seconds')),
      timeout_ms: Number(form.get('timeout_ms')),
      expected_status: Number(form.get('expected_status')),
      grace_threshold: Number(form.get('grace_threshold')),
      recovery_threshold: Number(form.get('recovery_threshold')),
      headers,
      body: method === 'POST' ? String(form.get('body') ?? '') || null : null,
      enabled: form.get('enabled') === 'on',
      is_public: form.get('is_public') === 'on',
      public_slug: String(form.get('public_slug') ?? '').trim() || null,
    };
    setPending(true);
    try {
      const res = await fetch(mode === 'create' ? '/api/v1/targets' : `/api/v1/targets/${target?.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: csrfHeaders(true),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const mapped = fieldErrorsFromApi(res.status, body);
        setFields(mapped.fields);
        setFormError(mapped.form);
        setPending(false);
        const focusId = firstInvalidField(mapped.fields, FIELD_ORDER);
        if (focusId) document.getElementById(focusId)?.focus();
        return;
      }
      if (mode === 'create') {
        const created = (await res.json()) as { id: string };
        window.location.assign(`/dashboard/targets/${created.id}`);
        return;
      }
      window.location.reload();
    } catch {
      setFormError('Could not reach the API');
      setPending(false);
    }
  }

  function describedBy(id: string): string | undefined {
    return fields[id] ? `${id}-error` : undefined;
  }

  return (
    <form className="form form--wide" method="post" action="#" onSubmit={onSubmit} noValidate>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        name="name"
        type="text"
        required
        maxLength={100}
        defaultValue={target?.name}
        aria-invalid={Boolean(fields.name)}
        aria-describedby={describedBy('name')}
      />
      {fields.name ? (
        <p className="form-error" id="name-error" role="alert">
          {fields.name}
        </p>
      ) : null}

      <label htmlFor="url">URL</label>
      <input
        id="url"
        name="url"
        type="url"
        required
        placeholder="http://mock-target:8080/health"
        defaultValue={target?.url}
        aria-invalid={Boolean(fields.url)}
        aria-describedby={describedBy('url')}
      />
      {fields.url ? (
        <p className="form-error" id="url-error" role="alert">
          {fields.url}
        </p>
      ) : null}

      <label htmlFor="method">Method</label>
      <select
        id="method"
        name="method"
        defaultValue={target?.method ?? 'GET'}
        onChange={(event) => setMethod(event.target.value)}
        aria-invalid={Boolean(fields.method)}
        aria-describedby={describedBy('method')}
      >
        <option value="GET">GET</option>
        <option value="HEAD">HEAD</option>
        <option value="POST">POST</option>
      </select>
      {fields.method ? (
        <p className="form-error" id="method-error" role="alert">
          {fields.method}
        </p>
      ) : null}

      <label htmlFor="interval_seconds">Interval (seconds)</label>
      <input
        id="interval_seconds"
        name="interval_seconds"
        type="number"
        min={30}
        max={3600}
        defaultValue={target?.interval_seconds ?? 60}
        aria-invalid={Boolean(fields.interval_seconds)}
        aria-describedby={describedBy('interval_seconds')}
      />
      {fields.interval_seconds ? (
        <p className="form-error" id="interval_seconds-error" role="alert">
          {fields.interval_seconds}
        </p>
      ) : null}

      <label htmlFor="timeout_ms">Timeout (ms)</label>
      <input
        id="timeout_ms"
        name="timeout_ms"
        type="number"
        min={500}
        max={10000}
        defaultValue={target?.timeout_ms ?? 5000}
        aria-invalid={Boolean(fields.timeout_ms)}
        aria-describedby={describedBy('timeout_ms')}
      />
      {fields.timeout_ms ? (
        <p className="form-error" id="timeout_ms-error" role="alert">
          {fields.timeout_ms}
        </p>
      ) : null}

      <label htmlFor="expected_status">Expected status</label>
      <input
        id="expected_status"
        name="expected_status"
        type="number"
        min={100}
        max={599}
        defaultValue={target?.expected_status ?? 200}
        aria-invalid={Boolean(fields.expected_status)}
        aria-describedby={describedBy('expected_status')}
      />
      {fields.expected_status ? (
        <p className="form-error" id="expected_status-error" role="alert">
          {fields.expected_status}
        </p>
      ) : null}

      <label htmlFor="grace_threshold">Grace threshold</label>
      <input
        id="grace_threshold"
        name="grace_threshold"
        type="number"
        min={1}
        max={10}
        defaultValue={target?.grace_threshold ?? 2}
        aria-invalid={Boolean(fields.grace_threshold)}
        aria-describedby={describedBy('grace_threshold')}
      />
      {fields.grace_threshold ? (
        <p className="form-error" id="grace_threshold-error" role="alert">
          {fields.grace_threshold}
        </p>
      ) : null}

      <label htmlFor="recovery_threshold">Recovery threshold</label>
      <input
        id="recovery_threshold"
        name="recovery_threshold"
        type="number"
        min={1}
        max={10}
        defaultValue={target?.recovery_threshold ?? 2}
        aria-invalid={Boolean(fields.recovery_threshold)}
        aria-describedby={describedBy('recovery_threshold')}
      />
      {fields.recovery_threshold ? (
        <p className="form-error" id="recovery_threshold-error" role="alert">
          {fields.recovery_threshold}
        </p>
      ) : null}

      <label htmlFor="headers">Headers (JSON object, optional)</label>
      <textarea
        id="headers"
        name="headers"
        rows={3}
        defaultValue={target?.headers ? JSON.stringify(target.headers, null, 2) : ''}
        aria-invalid={Boolean(fields.headers)}
        aria-describedby={describedBy('headers')}
      />
      {fields.headers ? (
        <p className="form-error" id="headers-error" role="alert">
          {fields.headers}
        </p>
      ) : null}

      {method === 'POST' ? (
        <>
          <label htmlFor="body">Body (POST only)</label>
          <textarea
            id="body"
            name="body"
            rows={3}
            defaultValue={target?.body ?? ''}
            aria-invalid={Boolean(fields.body)}
            aria-describedby={describedBy('body')}
          />
          {fields.body ? (
            <p className="form-error" id="body-error" role="alert">
              {fields.body}
            </p>
          ) : null}
        </>
      ) : null}

      <label className="check-label" htmlFor="enabled">
        <input id="enabled" name="enabled" type="checkbox" defaultChecked={target?.enabled ?? true} />
        Enabled (uncheck to pause)
      </label>

      <label className="check-label" htmlFor="is_public">
        <input
          id="is_public"
          name="is_public"
          type="checkbox"
          defaultChecked={target?.is_public ?? false}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        Public status page
      </label>

      <label htmlFor="public_slug">Public slug</label>
      <input
        id="public_slug"
        name="public_slug"
        type="text"
        placeholder="my-service"
        defaultValue={target?.public_slug ?? ''}
        aria-invalid={Boolean(fields.public_slug)}
        aria-describedby={describedBy('public_slug')}
      />
      {fields.public_slug ? (
        <p className="form-error" id="public_slug-error" role="alert">
          {fields.public_slug}
        </p>
      ) : null}
      {isPublic ? <p className="muted">Public pages are at /s/{'{slug}'}.</p> : null}

      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Saving…' : mode === 'create' ? 'Create monitor' : 'Save changes'}
      </button>
    </form>
  );
}
