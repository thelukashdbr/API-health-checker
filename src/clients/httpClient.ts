export interface FetchSuccess {
  statusCode: number;
  responseTimeMs: number;
}

export type FetchFailureReason = 'TIMEOUT' | 'CONNECTION_ERROR';

export class FetchFailure extends Error {
  constructor(
    public readonly reason: FetchFailureReason,
    public readonly responseTimeMs: number,
  ) {
    super(reason);
    this.name = 'FetchFailure';
  }
}

export async function fetchUrl(url: string, timeoutMs: number): Promise<FetchSuccess> {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      statusCode: response.status,
      responseTimeMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - start);
    const reason: FetchFailureReason =
      err instanceof Error && err.name === 'TimeoutError' ? 'TIMEOUT' : 'CONNECTION_ERROR';

    throw new FetchFailure(reason, responseTimeMs);
  }
}
