import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Domain Services & Adapters
import { AESEncryptionService } from '../infrastructure/security/aes-encryption.service.js';
import { MemoryRateLimiter } from '../infrastructure/rate-limiter/memory-rate-limiter.js';
import { GeminiProvider } from '../infrastructure/llm/gemini.provider.js';
import { OpenAIProvider } from '../infrastructure/llm/openai.provider.js';
import { ClaudeProvider } from '../infrastructure/llm/claude.provider.js';
import { OpenAICompatibleProvider } from '../infrastructure/llm/openai-compatible.provider.js';
import { LineMessagingGateway } from '../infrastructure/messaging/line-messaging.gateway.js';
import { TelegramMessagingGateway } from '../infrastructure/messaging/telegram-messaging.gateway.js';

// Repositories
import { getPrismaClient } from '../infrastructure/database/prisma-client.js';
import { PrismaProviderKeyRepository } from '../infrastructure/database/prisma-provider-key.repository.js';
import { PrismaAvailableModelRepository } from '../infrastructure/database/prisma-available-model.repository.js';
import { PrismaBotChannelRepository } from '../infrastructure/database/prisma-bot-channel.repository.js';
import { PrismaSystemPromptRepository } from '../infrastructure/database/prisma-system-prompt.repository.js';
import { PrismaUserPreferenceRepository } from '../infrastructure/database/prisma-user-preference.repository.js';
import { PrismaConversationHistoryRepository } from '../infrastructure/database/prisma-conversation-history.repository.js';
import { PrismaPushLogRepository } from '../infrastructure/database/prisma-push-log.repository.js';
import { PrismaUsageLogRepository } from '../infrastructure/database/prisma-usage-log.repository.js';
import { PrismaAdminUserRepository } from '../infrastructure/database/prisma-admin-user.repository.js';

// Application Use Cases
import { AuthenticateAdminUseCase } from '../application/use-cases/authenticate-admin.use-case.js';
import { RouteLLMQueryUseCase } from '../application/use-cases/route-llm-query.use-case.js';
import { HandleLineMessageUseCase } from '../application/use-cases/handle-line-message.use-case.js';
import { HandleTelegramMessageUseCase } from '../application/use-cases/handle-telegram-message.use-case.js';
import { ManageProviderKeysUseCase } from '../application/use-cases/manage-provider-keys.use-case.js';
import { ManageBotChannelsUseCase } from '../application/use-cases/manage-bot-channels.use-case.js';
import { ManageSystemPromptUseCase } from '../application/use-cases/manage-system-prompt.use-case.js';
import { SendPushMessageUseCase } from '../application/use-cases/send-push-message.use-case.js';
import { GetUsageStatsUseCase } from '../application/use-cases/get-usage-stats.use-case.js';

// Controllers & SSE
import { PushWatcherSSEManager } from './sse/push-watcher.sse.js';
import { registerAuthRoutes } from './controllers/auth.controller.js';
import { registerWebhookRoutes } from './controllers/webhook.controller.js';
import { registerKeysRoutes } from './controllers/keys.controller.js';
import { registerChannelsRoutes } from './controllers/channels.controller.js';
import { registerPromptRoutes } from './controllers/prompt.controller.js';
import { registerPushRoutes } from './controllers/push.controller.js';
import { registerUsageRoutes } from './controllers/usage.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Fastify type augmentation for JWT authentication
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
  });

  // 1. Plugins: CORS
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // 2. Plugins: JWT Authentication
  const jwtSecret = process.env.JWT_SECRET || 'fallback-super-secret-jwt-key-32-chars-long';
  await app.register(fastifyJwt, {
    secret: jwtSecret,
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized. Please login first.' });
    }
  });

  // 3. DI Composition Root: Instantiate Infrastructure
  const prisma = getPrismaClient();

  const encryptionSecret =
    process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const encryptionService = new AESEncryptionService(encryptionSecret);

  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_PER_MINUTE || '10', 10);
  const rateLimiter = new MemoryRateLimiter(rateLimitMax);

  const lineGateway = new LineMessagingGateway();
  const telegramGateway = new TelegramMessagingGateway();

  // LLM Provider Adapters Pool
  const providersMap = new Map();
  providersMap.set('gemini', new GeminiProvider());
  providersMap.set('openai', new OpenAIProvider());
  providersMap.set('claude', new ClaudeProvider());
  providersMap.set('openai_compatible', new OpenAICompatibleProvider());

  // Repositories
  const providerKeyRepo = new PrismaProviderKeyRepository(prisma);
  const availableModelRepo = new PrismaAvailableModelRepository(prisma);
  const botChannelRepo = new PrismaBotChannelRepository(prisma);
  const systemPromptRepo = new PrismaSystemPromptRepository(prisma);
  const userPreferenceRepo = new PrismaUserPreferenceRepository(prisma);
  const conversationHistoryRepo = new PrismaConversationHistoryRepository(prisma);
  const pushLogRepo = new PrismaPushLogRepository(prisma);
  const usageLogRepo = new PrismaUsageLogRepository(prisma);
  const adminUserRepo = new PrismaAdminUserRepository(prisma);

  // SSE Real-time Manager
  const sseManager = new PushWatcherSSEManager();

  // Application Use Cases
  const authenticateAdminUseCase = new AuthenticateAdminUseCase(adminUserRepo);

  const routeLLMQueryUseCase = new RouteLLMQueryUseCase(
    providerKeyRepo,
    availableModelRepo,
    userPreferenceRepo,
    usageLogRepo,
    encryptionService,
    providersMap
  );

  const handleLineMessageUseCase = new HandleLineMessageUseCase(
    botChannelRepo,
    conversationHistoryRepo,
    systemPromptRepo,
    userPreferenceRepo,
    availableModelRepo,
    providerKeyRepo,
    encryptionService,
    rateLimiter,
    lineGateway,
    routeLLMQueryUseCase
  );

  const handleTelegramMessageUseCase = new HandleTelegramMessageUseCase(
    botChannelRepo,
    conversationHistoryRepo,
    systemPromptRepo,
    userPreferenceRepo,
    availableModelRepo,
    providerKeyRepo,
    encryptionService,
    rateLimiter,
    telegramGateway,
    routeLLMQueryUseCase
  );

  const manageProviderKeysUseCase = new ManageProviderKeysUseCase(
    providerKeyRepo,
    availableModelRepo,
    encryptionService,
    providersMap
  );

  const manageBotChannelsUseCase = new ManageBotChannelsUseCase(
    botChannelRepo,
    encryptionService,
    lineGateway,
    telegramGateway
  );

  const manageSystemPromptUseCase = new ManageSystemPromptUseCase(systemPromptRepo);

  const sendPushMessageUseCase = new SendPushMessageUseCase(
    botChannelRepo,
    pushLogRepo,
    encryptionService,
    lineGateway,
    telegramGateway
  );

  // Hook push events directly into SSE broadcast
  sendPushMessageUseCase.onPushSent((event) => {
    sseManager.broadcastPushEvent(event);
  });

  const getUsageStatsUseCase = new GetUsageStatsUseCase(usageLogRepo);

  // Assistant & Receipt Services (Google Drive 5TB + Gemini Vision OCR)
  const { GoogleDriveStorageService } = await import('../infrastructure/storage/google-drive.storage.js');
  const { GeminiVisionReceiptScanner } = await import('../infrastructure/llm/gemini-vision.service.js');
  const { ProcessReceiptImageUseCase } = await import('../application/use-cases/process-receipt-image.use-case.js');

  const storageService = new GoogleDriveStorageService();
  const visionScanner = new GeminiVisionReceiptScanner();
  const processReceiptImageUseCase = new ProcessReceiptImageUseCase(
    prisma,
    botChannelRepo,
    providerKeyRepo,
    encryptionService,
    lineGateway,
    storageService,
    visionScanner
  );

  // Server Base URL for Webhook generation
  const serverBaseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

  // 4. Register Controllers & Endpoints
  registerAuthRoutes(app, authenticateAdminUseCase);
  registerWebhookRoutes(
    app,
    handleLineMessageUseCase,
    handleTelegramMessageUseCase,
    botChannelRepo,
    encryptionService,
    lineGateway,
    processReceiptImageUseCase
  );
  registerKeysRoutes(app, manageProviderKeysUseCase);
  registerChannelsRoutes(app, manageBotChannelsUseCase, serverBaseUrl);
  registerPromptRoutes(app, manageSystemPromptUseCase);
  registerPushRoutes(app, sendPushMessageUseCase, sseManager);
  registerUsageRoutes(app, getUsageStatsUseCase);

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // 5. Static file serving for Frontend Dashboard if built
  const frontendDistPath = path.resolve(__dirname, '../../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    await app.register(fastifyStatic, {
      root: frontendDistPath,
      prefix: '/',
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        reply.status(404).send({ error: 'API route not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}

// Direct Execution Entry Point
async function start() {
  try {
    const app = await buildServer();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Standalone Multi-LLM Harness Server listening on http://${host}:${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
