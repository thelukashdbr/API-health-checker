export const DEFAULT_TIMEOUT_MS = 5000;
export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 30000;

export const checkBodySchema = {
  type: 'object',
  required: ['url'],
  additionalProperties: false,
  properties: {
    url: { type: 'string', minLength: 1 },
    timeout: { type: 'integer', minimum: MIN_TIMEOUT_MS, maximum: MAX_TIMEOUT_MS },
  },
} as const;
