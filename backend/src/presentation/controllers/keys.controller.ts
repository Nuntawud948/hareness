import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ManageProviderKeysUseCase } from '../../application/use-cases/manage-provider-keys.use-case.js';
import { RouteLLMQueryUseCase } from '../../application/use-cases/route-llm-query.use-case.js';

const updateKeySchema = z.object({
  rawApiKey: z.string().optional(),
  displayName: z.string().optional(),
  baseUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  priorityOrder: z.number().optional(),
});

const createKeySchema = z.object({
  providerName: z.string().min(1, 'Provider name/type is required'),
  displayName: z.string().min(1, 'Display name is required'),
  rawApiKey: z.string().optional(),
  baseUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  priorityOrder: z.number().optional(),
  initialModelId: z.string().optional(),
  initialModelName: z.string().optional(),
});

const addModelSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  isDefault: z.boolean().optional(),
});

export function registerKeysRoutes(
  app: FastifyInstance,
  manageProviderKeysUseCase: ManageProviderKeysUseCase,
  routeLLMQueryUseCase?: RouteLLMQueryUseCase
) {
  // All endpoints here require Admin JWT authentication
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', app.authenticate);

    // List all provider keys & models
    protectedRoutes.get('/api/keys', async (request: FastifyRequest, reply: FastifyReply) => {
      const keys = await manageProviderKeysUseCase.getAll();
      return reply.send(keys);
    });

    // Create a new custom provider key
    protectedRoutes.post('/api/keys', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createKeySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      const id = await manageProviderKeysUseCase.createKey(parseResult.data);
      return reply.status(201).send({ success: true, id, message: 'Provider created successfully.' });
    });

    // Delete a provider key
    protectedRoutes.delete('/api/keys/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await manageProviderKeysUseCase.deleteKey(id);
      return reply.send({ success: true, message: 'Provider deleted successfully.' });
    });

    // Update a provider key (new raw API key, active state, priority, etc.)
    protectedRoutes.put('/api/keys/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateKeySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      await manageProviderKeysUseCase.updateKey(id, parseResult.data);
      return reply.send({ success: true, message: 'Provider key updated successfully.' });
    });

    // Test connection to provider with configured key
    protectedRoutes.post('/api/keys/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const result = await manageProviderKeysUseCase.testConnection(id);
      return reply.send(result);
    });

    // Add a new model to provider
    protectedRoutes.post('/api/keys/:id/models', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parseResult = addModelSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      await manageProviderKeysUseCase.addModel(
        id,
        parseResult.data.modelId,
        parseResult.data.displayName,
        parseResult.data.isDefault
      );
      return reply.send({ success: true, message: 'Model added successfully.' });
    });

    // Delete a model
    protectedRoutes.delete('/api/keys/models/:modelId', async (request: FastifyRequest, reply: FastifyReply) => {
      const { modelId } = request.params as { modelId: string };
      await manageProviderKeysUseCase.deleteModel(modelId);
      return reply.send({ success: true, message: 'Model deleted successfully.' });
    });

    // Set model as default for provider
    protectedRoutes.post(
      '/api/keys/:id/models/:modelId/default',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id, modelId } = request.params as { id: string; modelId: string };
        await manageProviderKeysUseCase.setDefaultModel(id, modelId);
        return reply.send({ success: true, message: 'Default model updated.' });
      }
    );

    // Live Interactive Chat Test / Playground endpoint
    protectedRoutes.post('/api/keys/chat-test', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!routeLLMQueryUseCase) {
        return reply.status(503).send({ error: 'LLM router not available.' });
      }

      const body = (request.body as any) || {};
      const userMessage = body.message ? String(body.message).trim() : '';

      if (!userMessage) {
        return reply.status(400).send({ error: 'Message cannot be empty.' });
      }

      try {
        const result = await routeLLMQueryUseCase.execute({
          platform: 'line',
          userId: 'admin-playground-tester',
          messages: [{ role: 'user', content: userMessage }],
          systemPrompt:
            body.systemPrompt ||
            'คุณคือผู้ช่วย AI อัจฉริยะ ตอบคำถามอย่างกระชับ ได้ใจความ และสุภาพเป็นมิตร',
          preferredModelOverride: body.modelId || null,
        });

        return reply.send({
          success: true,
          content: result.content,
          modelId: result.modelId,
          providerName: result.providerName,
          responseTimeMs: result.responseTimeMs,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          estimatedCostUsd: result.estimatedCostUsd,
          wasFailover: result.wasFailover,
          failoverReason: result.failoverReason,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: err.message || 'LLM generation failed',
        });
      }
    });
  });
}
