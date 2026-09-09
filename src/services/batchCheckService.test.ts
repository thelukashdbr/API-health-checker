import { describe, it, expect, vi } from 'vitest';
import { checkHealthBatch } from './batchCheckService.js';
import { checkHealth } from './healthCheckService.js';

vi.mock('./healthCheckService.js', () => ({
  checkHealth: vi.fn(),
}));

describe('checkHealthBatch', () => {
  it('checks all urls and preserves the original url and input order in the results', async () => {
    vi.mocked(checkHealth).mockImplementation(async (url) => {
      if (url === 'https://example.com/') {
        return { status: 'UP', statusCode: 200, responseTimeMs: 100 };
      }
      return { status: 'DOWN', statusCode: 500, responseTimeMs: 50 };
    });

    const results = await checkHealthBatch(['https://example.com', 'https://example.org'], 5000);

    expect(results).toEqual([
      { url: 'https://example.com', status: 'UP', statusCode: 200, responseTimeMs: 100 },
      { url: 'https://example.org', status: 'DOWN', statusCode: 500, responseTimeMs: 50 },
    ]);
  });

  it("a failing url does not prevent the others from being checked", async () => {
    vi.mocked(checkHealth).mockImplementation(async (url) => {
      if (url === 'https://down.example.com/') {
        return { status: 'DOWN', error: 'CONNECTION_ERROR', responseTimeMs: 20 };
      }
      return { status: 'UP', statusCode: 200, responseTimeMs: 80 };
    });

    const results = await checkHealthBatch(
      ['https://up.example.com', 'https://down.example.com'],
      5000,
    );

    expect(results.find((r) => r.url === 'https://up.example.com')).toMatchObject({
      status: 'UP',
    });
    expect(results.find((r) => r.url === 'https://down.example.com')).toMatchObject({
      status: 'DOWN',
      error: 'CONNECTION_ERROR',
    });
  });

  it('marks malformed urls as INVALID_URL without calling the health check for them', async () => {
    vi.mocked(checkHealth).mockResolvedValue({ status: 'UP', statusCode: 200, responseTimeMs: 80 });

    const results = await checkHealthBatch(['not-a-url', 'https://example.com'], 5000);

    expect(results[0]).toEqual({
      url: 'not-a-url',
      status: 'DOWN',
      error: 'INVALID_URL',
      responseTimeMs: 0,
    });
    expect(results[1]).toMatchObject({ status: 'UP' });
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });
});
