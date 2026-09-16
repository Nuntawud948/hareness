import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { HandleLineMessageUseCase } from '../../application/use-cases/handle-line-message.use-case.js';
import { HandleTelegramMessageUseCase } from '../../application/use-cases/handle-telegram-message.use-case.js';
import { ProcessReceiptImageUseCase } from '../../application/use-cases/process-receipt-image.use-case.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILineMessagingGateway } from '../../domain/services/i-messaging-gateway.js';

export function registerWebhookRoutes(
  app: FastifyInstance,
  handleLineMessageUseCase: HandleLineMessageUseCase,
  handleTelegramMessageUseCase: HandleTelegramMessageUseCase,
  botChannelRepo: IBotChannelRepository,
  encryptionService: IEncryptionService,
  lineGateway: ILineMessagingGateway,
  processReceiptImageUseCase?: ProcessReceiptImageUseCase
) {
  // ── LINE Webhook ──
  app.post('/webhook/line', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = (request.headers['x-line-signature'] as string) || '';

    // 1. Fetch channel config
    const channel = await botChannelRepo.findByPlatform('line');
    if (!channel || !channel.isActive || !channel.lineChannelSecret) {
      // Channel not configured yet
      return reply.status(503).send({ error: 'LINE channel not configured or inactive.' });
    }

    // 2. Verify signature
    let channelSecret = '';
    try {
      channelSecret = encryptionService.decrypt(channel.lineChannelSecret);
    } catch {
      return reply.status(500).send({ error: 'Failed to decrypt channel secret.' });
    }

    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    const isValid = lineGateway.verifySignature(rawBody, signature, channelSecret);

    if (!isValid && process.env.NODE_ENV === 'production') {
      return reply.status(401).send({ error: 'Invalid LINE signature' });
    }

    const body = request.body as { events?: any[] };
    const events = body?.events || [];

    // Process events asynchronously so we immediately return 200 to LINE
    reply.status(200).send({ status: 'ok' });

    for (const event of events) {
      if (event.type === 'message') {
        const replyToken = event.replyToken;
        const userId = event.source?.userId || 'unknown-user';

        // 1. Handle Text Messages
        if (event.message?.type === 'text') {
          const userMessage = event.message.text;
          handleLineMessageUseCase
            .execute({
              replyToken,
              userId,
              userMessage,
            })
            .catch((err) => {
              console.error('Error processing LINE webhook text event:', err);
            });
        }
        // 2. Handle Image / Receipt Messages (Vision AI + Google Drive 5TB)
        else if (event.message?.type === 'image' && processReceiptImageUseCase) {
          const messageId = event.message.id;
          processReceiptImageUseCase
            .execute({
              platform: 'line',
              userId,
              messageId,
              replyToken,
            })
            .catch((err) => {
              console.error('Error processing LINE receipt image:', err);
            });
        }
      }
    }
  });

  // ── Telegram Webhook ──
  app.post('/webhook/telegram', async (request: FastifyRequest, reply: FastifyReply) => {
    const channel = await botChannelRepo.findByPlatform('telegram');
    if (!channel || !channel.isActive || !channel.telegramBotToken) {
      return reply.status(503).send({ error: 'Telegram channel not configured or inactive.' });
    }

    // Check secret token header if configured
    if (channel.telegramWebhookSecret) {
      const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
      if (secretHeader !== channel.telegramWebhookSecret && process.env.NODE_ENV === 'production') {
        return reply.status(401).send({ error: 'Invalid webhook secret token' });
      }
    }

    const update = request.body as any;

    // Immediately acknowledge Telegram
    reply.status(200).send({ status: 'ok' });

    if (update && update.message && update.message.text) {
      const chatId = String(update.message.chat.id);
      const userId = String(update.message.from?.id || chatId);
      const messageId = update.message.message_id;
      const userMessage = update.message.text;

      handleTelegramMessageUseCase
        .execute({
          chatId,
          userId,
          messageId,
          userMessage,
        })
        .catch((err) => {
          console.error('Error processing Telegram update:', err);
        });
    }
  });
}
