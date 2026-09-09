import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from './checkSchema.js';

export const MAX_BATCH_SIZE = 20;

export const batchCheckBodySchema = {
  type: 'object',
  required: ['urls'],
  additionalProperties: false,
  properties: {
    urls: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      maxItems: MAX_BATCH_SIZE,
    },
    timeout: { type: 'integer', minimum: MIN_TIMEOUT_MS, maximum: MAX_TIMEOUT_MS },
  },
} as const;
