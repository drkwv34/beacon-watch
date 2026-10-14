import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { BODY_MAX_BYTES, HEADERS_MAX_BYTES, validateTargetInput } from './target.js';

function fieldsOf(err: unknown): Record<string, string> {
  expect(err).toBeInstanceOf(DomainError);
  const details = (err as DomainError).details;
  expect(details).toBeTruthy();
  return details!['fields'] as Record<string, string>;
}

const valid = { name: 'Homepage', url: 'https://example.com/health' };

describe('validateTargetInput', () => {
  it('applies SRS defaults', () => {
    const t = validateTargetInput(valid);
    expect(t.method).toBe('GET');
    expect(t.interval_seconds).toBe(60);
    expect(t.timeout_ms).toBe(5000);
    expect(t.expected_status).toBe(200);
    expect(t.grace_threshold).toBe(2);
    expect(t.recovery_threshold).toBe(2);
    expect(t.enabled).toBe(true);
    expect(t.is_public).toBe(false);
    expect(t.body).toBeNull();
    expect(t.headers).toBeNull();
  });

  it('rejects interval 29 and 3601', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, interval_seconds: 29 })))).toHaveProperty(
      'interval_seconds',
    );
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, interval_seconds: 3601 })))).toHaveProperty(
      'interval_seconds',
    );
  });

  it('rejects timeout 499 and 10001', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, timeout_ms: 499 })))).toHaveProperty('timeout_ms');
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, timeout_ms: 10001 })))).toHaveProperty('timeout_ms');
  });

  it('rejects method PUT', () => {
    expect(
      fieldsOf(catchErr(() => validateTargetInput({ ...valid, method: 'PUT' as unknown as 'GET' }))),
    ).toHaveProperty('method');
  });

  it('rejects ftp URLs and userinfo', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, url: 'ftp://example.com' })))).toHaveProperty('url');
    expect(
      fieldsOf(catchErr(() => validateTargetInput({ ...valid, url: 'https://user:pass@example.com' }))),
    ).toHaveProperty('url');
  });

  it('rejects a body on GET', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, body: '{}' })))).toHaveProperty('body');
  });

  it('accepts a POST body at 8 KiB and rejects over', () => {
    const ok = 'x'.repeat(BODY_MAX_BYTES);
    expect(validateTargetInput({ ...valid, method: 'POST', body: ok }).body).toHaveLength(BODY_MAX_BYTES);
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, method: 'POST', body: `${ok}y` })))).toHaveProperty(
      'body',
    );
  });

  it('rejects oversized headers JSON', () => {
    const headers: Record<string, string> = {};
    let i = 0;
    while (JSON.stringify(headers).length <= HEADERS_MAX_BYTES) {
      headers[`h${i}`] = 'v'.repeat(200);
      i += 1;
    }
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, headers })))).toHaveProperty('headers');
  });

  it('rejects a bad public_slug and accepts a valid one', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, public_slug: 'Nope' })))).toHaveProperty(
      'public_slug',
    );
    expect(validateTargetInput({ ...valid, public_slug: 'status-ok' }).public_slug).toBe('status-ok');
  });

  it('rejects metadata hostnames before DNS', () => {
    expect(fieldsOf(catchErr(() => validateTargetInput({ ...valid, url: 'http://metadata/' })))).toHaveProperty('url');
  });
});

function catchErr(fn: () => unknown): unknown {
  try {
    fn();
    throw new Error('expected throw');
  } catch (err) {
    return err;
  }
}
