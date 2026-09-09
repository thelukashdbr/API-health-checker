import { checkHealth } from './healthCheckService.js';
import { parseAndValidateUrl } from '../schemas/url.js';
import { ValidationError } from '../errors.js';
import { BatchCheckResult } from '../types/check.js';

export async function checkHealthBatch(
  urls: string[],
  timeoutMs: number,
): Promise<BatchCheckResult[]> {
  return Promise.all(urls.map((url) => checkOne(url, timeoutMs)));
}

async function checkOne(url: string, timeoutMs: number): Promise<BatchCheckResult> {
  try {
    const validatedUrl = parseAndValidateUrl(url);
    const result = await checkHealth(validatedUrl.toString(), timeoutMs);

    return { url, ...result };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { url, status: 'DOWN', error: 'INVALID_URL', responseTimeMs: 0 };
    }

    throw err;
  }
}
