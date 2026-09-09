import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildApp } from '../app.js';

describe('POST /checks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns UP for a healthy endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: { url: 'https://example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'UP', statusCode: 200 });
  });

  it('returns DOWN for a failing endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: { url: 'https://example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'DOWN', statusCode: 500 });
  });

  it('rejects a malformed URL with 400', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: { url: 'not-a-url' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-http(s) protocol with 400', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: { url: 'ftp://example.com' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });

  it('rejects a timeout outside the allowed range with 400', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: { url: 'https://example.com', timeout: 999999 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing url with 400', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });
});
