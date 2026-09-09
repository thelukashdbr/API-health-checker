import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

export interface FetchSuccess {
  statusCode: number;
  responseTimeMs: number;
}

export type FetchFailureReason = 'TIMEOUT' | 'CONNECTION_ERROR' | 'BLOCKED_ADDRESS';

export class FetchFailure extends Error {
  constructor(
    public readonly reason: FetchFailureReason,
    public readonly responseTimeMs: number,
  ) {
    super(reason);
    this.name = 'FetchFailure';
  }
}

class BlockedAddressError extends Error {}

// Minimal SSRF guard: resolves the hostname once and rejects well-known
// private/loopback/link-local ranges (including the 169.254.169.254 cloud
// metadata address). It does NOT protect against DNS rebinding (the resolved
// address could change between this check and the actual fetch) — that's a
// known, documented limitation for this project's scope.
async function assertPublicHost(hostname: string): Promise<void> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  const address = isIP(literal) ? literal : (await dns.lookup(literal)).address;

  if (isPrivateAddress(address)) {
    throw new BlockedAddressError(`"${address}" is a private/internal address`);
  }
}

function isPrivateAddress(address: string): boolean {
  return isIP(address) === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
}

export async function fetchUrl(url: string, timeoutMs: number): Promise<FetchSuccess> {
  const start = performance.now();

  try {
    await assertPublicHost(new URL(url).hostname);

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

    if (err instanceof BlockedAddressError) {
      throw new FetchFailure('BLOCKED_ADDRESS', responseTimeMs);
    }

    const reason: FetchFailureReason =
      err instanceof Error && err.name === 'TimeoutError' ? 'TIMEOUT' : 'CONNECTION_ERROR';

    throw new FetchFailure(reason, responseTimeMs);
  }
}
