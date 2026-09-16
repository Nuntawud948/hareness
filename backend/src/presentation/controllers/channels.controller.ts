import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ManageBotChannelsUseCase } from '../../application/use-cases/manage-bot-channels.use-case.js';
import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';

const updateLineSchema = z.object({
  lineChannelSecret: z.string().optional(),
  lineAccessToken: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateTelegramSchema = z.object({
  telegramBotToken: z.string().optional(),
  telegramWebhookSecret: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateDiscordSchema = z.object({
  discordBotToken: z.string().optional(),
  discordApplicationId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export function registerChannelsRoutes(
  app: FastifyInstance,
  manageBotChannelsUseCase: ManageBotChannelsUseCase,
  serverBaseUrl: string,
  onDiscordTokenUpdated?: (token: string) => Promise<void>
) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', app.authenticate);

    // List bot channels (with masked tokens & webhook URLs)
    protectedRoutes.get('/api/channels', async (request: FastifyRequest, reply: FastifyReply) => {
      const channels = await manageBotChannelsUseCase.getAll(serverBaseUrl);
      return reply.send(channels);
    });

    // Update LINE channel credentials
    protectedRoutes.put('/api/channels/line', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateLineSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      await manageBotChannelsUseCase.updateLineChannel(parseResult.data);
      return reply.send({ success: true, message: 'LINE channel configuration saved.' });
    });

    // Update Telegram channel credentials
    protectedRoutes.put('/api/channels/telegram', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateTelegramSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      await manageBotChannelsUseCase.updateTelegramChannel(parseResult.data);
      return reply.send({ success: true, message: 'Telegram channel configuration saved.' });
    });

    // Update Discord channel credentials
    protectedRoutes.put('/api/channels/discord', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateDiscordSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      await manageBotChannelsUseCase.updateDiscordChannel(parseResult.data);
      if (parseResult.data.discordBotToken && onDiscordTokenUpdated) {
        try {
          await onDiscordTokenUpdated(parseResult.data.discordBotToken);
        } catch (e: any) {
          console.error('Failed to restart Discord bot on token update:', e.message);
        }
      }
      return reply.send({ success: true, message: 'Discord channel configuration saved.' });
    });

    // Verify channel credentials against platform API
    protectedRoutes.post('/api/channels/:platform/verify', async (request: FastifyRequest, reply: FastifyReply) => {
      const { platform } = request.params as { platform: string };
      if (platform !== 'line' && platform !== 'telegram' && platform !== 'discord') {
        return reply.status(400).send({ error: 'Platform must be line, telegram, or discord' });
      }

      const result = await manageBotChannelsUseCase.verifyChannel(platform as BotPlatform);
      return reply.send(result);
    });
  });
}
