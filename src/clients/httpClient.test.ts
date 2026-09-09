import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchUrl } from './httpClient.js';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock('node:dns', () => ({
  promises: { lookup: lookupMock },
}));

describe('fetchUrl', () => {
  beforeEach(() => {
    lookupMock.mockResolvedValue({ address: '93.184.216.34', family: 4 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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

  it('rejects with reason BLOCKED_ADDRESS for a literal loopback IP, without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUrl('http://127.0.0.1:8080/', 5000)).rejects.toMatchObject({
      reason: 'BLOCKED_ADDRESS',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with reason BLOCKED_ADDRESS for the cloud metadata address', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUrl('http://169.254.169.254/latest/meta-data', 5000)).rejects.toMatchObject({
      reason: 'BLOCKED_ADDRESS',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with reason BLOCKED_ADDRESS when a hostname resolves to a private address', async () => {
    lookupMock.mockResolvedValue({ address: '10.0.0.5', family: 4 });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUrl('https://internal.example.com', 5000)).rejects.toMatchObject({
      reason: 'BLOCKED_ADDRESS',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
