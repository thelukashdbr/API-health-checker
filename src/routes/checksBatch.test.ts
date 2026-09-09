import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildApp } from '../app.js';

describe('POST /checks/batch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('checks multiple urls concurrently and reports each result independently', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('down.example.com')) {
          return Promise.reject(new TypeError('fetch failed'));
        }
        return Promise.resolve(new Response(null, { status: 200 }));
      }),
    );
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks/batch',
      payload: { urls: ['https://up.example.com', 'https://down.example.com'] },
    });

    expect(response.statusCode).toBe(200);
    const { results } = response.json();

    expect(results).toHaveLength(2);
    expect(results.find((r: { url: string }) => r.url === 'https://up.example.com')).toMatchObject(
      { status: 'UP', statusCode: 200 },
    );
    expect(
      results.find((r: { url: string }) => r.url === 'https://down.example.com'),
    ).toMatchObject({ status: 'DOWN', error: 'CONNECTION_ERROR' });
  });

  it('marks a malformed url in the batch as INVALID_URL instead of failing the whole request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks/batch',
      payload: { urls: ['not-a-url', 'https://example.com'] },
    });

    expect(response.statusCode).toBe(200);
    const { results } = response.json();

    expect(results[0]).toMatchObject({ url: 'not-a-url', status: 'DOWN', error: 'INVALID_URL' });
    expect(results[1]).toMatchObject({ status: 'UP' });
  });

  it('rejects an empty urls array with 400', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checks/batch',
      payload: { urls: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });

  it('rejects a batch larger than the allowed limit with 400', async () => {
    const app = buildApp();
    const urls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com`);

    const response = await app.inject({
      method: 'POST',
      url: '/checks/batch',
      payload: { urls },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });
});
