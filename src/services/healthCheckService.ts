import { fetchUrl, FetchFailure } from '../clients/httpClient.js';
import { CheckResult } from '../types/check.js';

const MAX_HEALTHY_STATUS_CODE = 399;

export async function checkHealth(url: string, timeoutMs: number): Promise<CheckResult> {
  try {
    const { statusCode, responseTimeMs } = await fetchUrl(url, timeoutMs);

    return {
      status: statusCode <= MAX_HEALTHY_STATUS_CODE ? 'UP' : 'DOWN',
      statusCode,
      responseTimeMs,
    };
  } catch (err) {
    if (err instanceof FetchFailure) {
      return {
        status: 'DOWN',
        error: err.reason,
        responseTimeMs: err.responseTimeMs,
      };
    }

    throw err;
  }
}
