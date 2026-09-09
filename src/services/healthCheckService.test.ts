import { describe, it, expect, vi } from 'vitest';
import { checkHealth } from './healthCheckService.js';
import { fetchUrl, FetchFailure } from '../clients/httpClient.js';

vi.mock('../clients/httpClient.js', async () => {
  const actual = await vi.importActual<typeof import('../clients/httpClient.js')>(
    '../clients/httpClient.js',
  );

  return {
    ...actual,
    fetchUrl: vi.fn(),
  };
});

describe('checkHealth', () => {
  it('returns UP for a 200 response', async () => {
    vi.mocked(fetchUrl).mockResolvedValue({ statusCode: 200, responseTimeMs: 143 });

    const result = await checkHealth('https://example.com', 5000);

    expect(result).toEqual({ status: 'UP', statusCode: 200, responseTimeMs: 143 });
  });

  it('returns DOWN for a 500 response', async () => {
    vi.mocked(fetchUrl).mockResolvedValue({ statusCode: 500, responseTimeMs: 90 });

    const result = await checkHealth('https://example.com', 5000);

    expect(result).toEqual({ status: 'DOWN', statusCode: 500, responseTimeMs: 90 });
  });

  it('returns DOWN for a 404 response', async () => {
    vi.mocked(fetchUrl).mockResolvedValue({ statusCode: 404, responseTimeMs: 50 });

    const result = await checkHealth('https://example.com', 5000);

    expect(result).toEqual({ status: 'DOWN', statusCode: 404, responseTimeMs: 50 });
  });

  it('returns DOWN with error TIMEOUT when the request times out', async () => {
    vi.mocked(fetchUrl).mockRejectedValue(new FetchFailure('TIMEOUT', 5000));

    const result = await checkHealth('https://example.com', 5000);

    expect(result).toEqual({ status: 'DOWN', error: 'TIMEOUT', responseTimeMs: 5000 });
  });

  it('returns DOWN with error CONNECTION_ERROR when the connection fails', async () => {
    vi.mocked(fetchUrl).mockRejectedValue(new FetchFailure('CONNECTION_ERROR', 12));

    const result = await checkHealth('https://example.com', 5000);

    expect(result).toEqual({ status: 'DOWN', error: 'CONNECTION_ERROR', responseTimeMs: 12 });
  });
});
