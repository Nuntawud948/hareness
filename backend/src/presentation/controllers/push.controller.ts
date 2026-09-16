import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SendPushMessageUseCase } from '../../application/use-cases/send-push-message.use-case.js';
import { PushWatcherSSEManager } from '../sse/push-watcher.sse.js';

const pushSchema = z.object({
  platform: z.enum(['line', 'telegram']),
  targetId: z.string().min(1, 'Target ID (userId or chatId) is required'),
  message: z.string().min(1, 'Message is required'),
  sourceTrigger: z.string().optional(),
});

export function registerPushRoutes(
  app: FastifyInstance,
  sendPushMessageUseCase: SendPushMessageUseCase,
  sseManager: PushWatcherSSEManager
) {
  // ── Public / Internal API: Trigger Push Message ──
  // (Can be authenticated via Bearer JWT or custom internal API key header)
  app.post('/api/push', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = pushSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    const result = await sendPushMessageUseCase.execute(parseResult.data);
    return reply.status(result.success ? 200 : 500).send(result);
  });

  // ── Real-time Push Watcher via Server-Sent Events (SSE) ──
  app.get('/api/push/watch', async (request: FastifyRequest, reply: FastifyReply) => {
    sseManager.addClient(request, reply);
  });

  // ── Recent Push Logs (Protected) ──
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', app.authenticate);

    protectedRoutes.get('/api/push/logs', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const logs = await sendPushMessageUseCase.getRecentLogs(limit);
      return reply.send(logs);
    });
  });
}
