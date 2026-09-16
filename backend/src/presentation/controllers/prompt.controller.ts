import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ManageSystemPromptUseCase } from '../../application/use-cases/manage-system-prompt.use-case.js';

const promptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
  isActive: z.boolean().optional(),
});

export function registerPromptRoutes(
  app: FastifyInstance,
  manageSystemPromptUseCase: ManageSystemPromptUseCase
) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', app.authenticate);

    protectedRoutes.get('/api/prompts', async (request: FastifyRequest, reply: FastifyReply) => {
      const prompts = await manageSystemPromptUseCase.getAll();
      return reply.send(prompts);
    });

    protectedRoutes.get('/api/prompts/active', async (request: FastifyRequest, reply: FastifyReply) => {
      const prompt = await manageSystemPromptUseCase.getActive();
      return reply.send(prompt);
    });

    protectedRoutes.post('/api/prompts', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = promptSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      const created = await manageSystemPromptUseCase.create(
        parseResult.data.name,
        parseResult.data.content,
        parseResult.data.isActive
      );
      return reply.status(201).send(created);
    });

    protectedRoutes.put('/api/prompts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parseResult = promptSchema.partial().safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      const updated = await manageSystemPromptUseCase.update(
        id,
        parseResult.data.name,
        parseResult.data.content
      );
      return reply.send(updated);
    });

    protectedRoutes.delete('/api/prompts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await manageSystemPromptUseCase.delete(id);
      return reply.send({ success: true, message: 'System prompt deleted.' });
    });

    protectedRoutes.post('/api/prompts/:id/activate', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await manageSystemPromptUseCase.activate(id);
      return reply.send({ success: true, message: 'System prompt activated.' });
    });
  });
}
