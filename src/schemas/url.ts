import { ValidationError } from '../errors.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function parseAndValidateUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError(`"${rawUrl}" is not a valid URL`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError(
      `Unsupported protocol "${parsed.protocol}". Only http and https are allowed.`,
    );
  }

  return parsed;
}
