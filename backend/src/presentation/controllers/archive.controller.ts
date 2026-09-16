import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArchiveMonthlyLogsUseCase } from '../../application/use-cases/archive-monthly-logs.use-case.js';

export function registerArchiveController(
  app: FastifyInstance,
  archiveUseCase: ArchiveMonthlyLogsUseCase
) {
  app.post(
    '/api/archive/run',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body as any) || {};
        const retentionDays = body.retentionDays ? parseInt(body.retentionDays, 10) : 30;

        const result = await archiveUseCase.execute(retentionDays);
        return reply.status(200).send({
          success: true,
          message: 'Data archived to Google Drive and Neon DB pruned successfully',
          data: result,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || 'Archival failed',
        });
      }
    }
  );
}
