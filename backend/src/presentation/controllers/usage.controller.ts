import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GetUsageStatsUseCase } from '../../application/use-cases/get-usage-stats.use-case.js';

export function registerUsageRoutes(
  app: FastifyInstance,
  getUsageStatsUseCase: GetUsageStatsUseCase
) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', app.authenticate);

    protectedRoutes.get('/api/usage/summary', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { days?: string };
      const days = query.days ? parseInt(query.days, 10) : 30;
      const summary = await getUsageStatsUseCase.getSummary(days);
      return reply.send(summary);
    });

    protectedRoutes.get('/api/usage/logs', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const logs = await getUsageStatsUseCase.getRecentLogs(limit);
      return reply.send(logs);
    });
  });
}
