import { describe, expect, it } from 'vitest';
import { fieldErrorsFromApi, firstInvalidField } from './api-errors.js';

describe('fieldErrorsFromApi', () => {
  it('maps VALIDATION_FAILED details.fields', () => {
    const result = fieldErrorsFromApi(400, {
      error: { code: 'VALIDATION_FAILED', message: 'Invalid target', details: { fields: { url: 'must be http' } } },
    });
    expect(result.fields.url).toBe('must be http');
    expect(result.form).toBeUndefined();
  });

  it('maps 409 slug-taken onto public_slug', () => {
    const result = fieldErrorsFromApi(409, {
      error: { code: 'CONFLICT', message: 'Slug already taken', details: { field: 'public_slug' } },
    });
    expect(result.fields.public_slug).toBe('Slug already taken');
  });

  it('falls back to a form-level message', () => {
    const result = fieldErrorsFromApi(500, { error: { message: 'Internal server error' } });
    expect(result.form).toBe('Internal server error');
  });
});

describe('firstInvalidField', () => {
  it('returns the first field in document order', () => {
    expect(firstInvalidField({ public_slug: 'taken', url: 'bad' }, ['name', 'url', 'public_slug'])).toBe('url');
  });
});
