import { FastifyInstance } from 'fastify';
import { batchCheckBodySchema } from '../schemas/batchCheckSchema.js';
import { DEFAULT_TIMEOUT_MS } from '../schemas/checkSchema.js';
import { checkHealthBatch } from '../services/batchCheckService.js';

interface BatchCheckBody {
  urls: string[];
  timeout?: number;
}

export async function checksBatchRoutes(app: FastifyInstance) {
  app.post<{ Body: BatchCheckBody }>(
    '/checks/batch',
    { schema: { body: batchCheckBodySchema } },
    async (request) => {
      const { urls, timeout = DEFAULT_TIMEOUT_MS } = request.body;

      const results = await checkHealthBatch(urls, timeout);

      return { results };
    },
  );
}
