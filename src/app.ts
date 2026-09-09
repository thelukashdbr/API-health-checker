import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { checksRoutes } from './routes/checks.js';
import { checksBatchRoutes } from './routes/checksBatch.js';
import { ValidationError } from './errors.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(healthRoutes);
  app.register(checksRoutes);
  app.register(checksBatchRoutes);

  app.setErrorHandler<FastifyError | ValidationError>((error, _request, reply) => {
    if (error instanceof ValidationError || error.validation) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    app.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });

  return app;
}
