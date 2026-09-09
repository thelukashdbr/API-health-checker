import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUrl } from './httpClient.js';

describe('fetchUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with statusCode and responseTimeMs on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    const result = await fetchUrl('https://example.com', 5000);

    expect(result.statusCode).toBe(200);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects with reason CONNECTION_ERROR on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(fetchUrl('https://example.com', 5000)).rejects.toMatchObject({
      reason: 'CONNECTION_ERROR',
    });
  });

  it('rejects with reason TIMEOUT when the signal aborts due to timeout', async () => {
    const timeoutError = new DOMException('The operation timed out', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    await expect(fetchUrl('https://example.com', 5000)).rejects.toMatchObject({
      reason: 'TIMEOUT',
    });
  });
});
