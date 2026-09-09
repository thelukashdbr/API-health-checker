import { FastifyInstance } from 'fastify';
import { checkBodySchema, DEFAULT_TIMEOUT_MS } from '../schemas/checkSchema.js';
import { parseAndValidateUrl } from '../schemas/url.js';
import { checkHealth } from '../services/healthCheckService.js';

interface CheckBody {
  url: string;
  timeout?: number;
}

export async function checksRoutes(app: FastifyInstance) {
  app.post<{ Body: CheckBody }>(
    '/checks',
    { schema: { body: checkBodySchema } },
    async (request) => {
      const { url, timeout = DEFAULT_TIMEOUT_MS } = request.body;

      const validatedUrl = parseAndValidateUrl(url);

      return checkHealth(validatedUrl.toString(), timeout);
    },
  );
}
