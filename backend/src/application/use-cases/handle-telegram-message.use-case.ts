import { ChannelNotConfiguredError, RateLimitExceededError } from '../../domain/errors/domain.error.js';
import { IAvailableModelRepository } from '../../domain/repositories/i-available-model.repository.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IConversationHistoryRepository } from '../../domain/repositories/i-conversation-history.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { ISystemPromptRepository } from '../../domain/repositories/i-system-prompt.repository.js';
import { IUserPreferenceRepository } from '../../domain/repositories/i-user-preference.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ITelegramMessagingGateway } from '../../domain/services/i-messaging-gateway.js';
import { IRateLimiter } from '../../domain/services/i-rate-limiter.js';
import { RouteLLMQueryUseCase } from './route-llm-query.use-case.js';

export interface HandleTelegramMessageInput {
  chatId: string;
  userId: string;
  messageId?: number;
  userMessage: string;
}

export class HandleTelegramMessageUseCase {
  constructor(
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly conversationHistoryRepo: IConversationHistoryRepository,
    private readonly systemPromptRepo: ISystemPromptRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly availableModelRepo: IAvailableModelRepository,
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly rateLimiter: IRateLimiter,
    private readonly telegramGateway: ITelegramMessagingGateway,
    private readonly routeLLMQueryUseCase: RouteLLMQueryUseCase
  ) {}

  async execute(input: HandleTelegramMessageInput): Promise<void> {
    const { chatId, userId, messageId, userMessage } = input;
    const trimmedMessage = userMessage.trim();

    // 1. Fetch Telegram bot channel config
    const channel = await this.botChannelRepo.findByPlatform('telegram');
    if (!channel || !channel.isActive || !channel.telegramBotToken) {
      throw new ChannelNotConfiguredError('telegram');
    }

    const botToken = this.encryptionService.decrypt(channel.telegramBotToken);

    // 2. Check rate limit
    const rateResult = await this.rateLimiter.checkLimit(`telegram:${userId}`);
    if (!rateResult.allowed) {
      await this.telegramGateway.sendMessage(
        chatId,
        `⏳ Too many messages. Please wait ${rateResult.resetSeconds}s before sending another message.`,
        botToken,
        messageId
      );
      throw new RateLimitExceededError(rateResult.resetSeconds);
    }

    // 3. Command handling
    if (trimmedMessage.startsWith('/')) {
      await this.handleCommand(trimmedMessage, chatId, userId, messageId, botToken);
      return;
    }

    // 4. Regular chat completion
    const activePrompt = await this.systemPromptRepo.findActive();
    const systemPromptContent = activePrompt?.content;

    const history = await this.conversationHistoryRepo.getRecentHistory('telegram', chatId, 20);
    await this.conversationHistoryRepo.appendMessage('telegram', chatId, 'user', trimmedMessage);

    try {
      const completion = await this.routeLLMQueryUseCase.execute({
        platform: 'telegram',
        userId,
        messages: [
          ...history,
          { role: 'user', content: trimmedMessage }
        ],
        systemPrompt: systemPromptContent,
      });

      await this.conversationHistoryRepo.appendMessage('telegram', chatId, 'assistant', completion.content);
      await this.telegramGateway.sendMessage(chatId, completion.content, botToken, messageId);
    } catch (err: any) {
      console.error('Error generating Telegram reply:', err);
      await this.telegramGateway.sendMessage(
        chatId,
        '⚠️ An error occurred while generating the response. Please try again later.',
        botToken,
        messageId
      );
    }
  }

  private async handleCommand(
    commandText: string,
    chatId: string,
    userId: string,
    messageId: number | undefined,
    botToken: string
  ): Promise<void> {
    const parts = commandText.split(' ');
    const command = parts[0].toLowerCase().split('@')[0]; // Strip bot mention if in group
    const arg = parts.slice(1).join(' ').trim();

    if (command === '/start' || command === '/help') {
      const text = [
        '👋 Welcome to the Multi-LLM AI Bot!',
        '',
        'Available commands:',
        '• /models - View all available AI models',
        '• /model <name> - Switch to a specific AI model',
        '• /model reset - Revert to system default model',
        '• /clear - Reset conversation history for this chat',
        '• /help - Show this guide',
      ].join('\n');
      await this.telegramGateway.sendMessage(chatId, text, botToken, messageId);
      return;
    }

    if (command === '/clear' || command === '/reset') {
      await this.conversationHistoryRepo.clearHistory('telegram', chatId);
      await this.telegramGateway.sendMessage(
        chatId,
        '🧹 Conversation context cleared successfully.',
        botToken,
        messageId
      );
      return;
    }

    if (command === '/models') {
      const activeKeys = await this.providerKeyRepo.findActiveOrdered();
      if (activeKeys.length === 0) {
        await this.telegramGateway.sendMessage(chatId, '⚠️ No AI models are currently enabled.', botToken, messageId);
        return;
      }

      const pref = await this.userPreferenceRepo.findByUser('telegram', userId);
      const currentPref = pref?.preferredModel;

      const lines: string[] = ['🤖 Available AI Models:'];
      for (const key of activeKeys) {
        lines.push(`\n*${key.displayName}*`);
        const models = await this.availableModelRepo.findByProviderId(key.id);
        for (const m of models) {
          const isSelected = currentPref === m.modelId ? ' ✅ (Current)' : '';
          lines.push(`• \`${m.modelId}\` - ${m.displayName}${isSelected}`);
        }
      }
      lines.push('\nUse `/model <name>` to switch.');

      await this.telegramGateway.sendMessage(chatId, lines.join('\n'), botToken, messageId);
      return;
    }

    if (command === '/model') {
      if (!arg || arg.toLowerCase() === 'reset') {
        await this.userPreferenceRepo.setPreferredModel('telegram', userId, null);
        await this.telegramGateway.sendMessage(
          chatId,
          '🔄 Model preference reset to system default.',
          botToken,
          messageId
        );
        return;
      }

      const targetModel = await this.availableModelRepo.findByModelId(arg);
      if (!targetModel) {
        await this.telegramGateway.sendMessage(
          chatId,
          `❌ Model \`${arg}\` not found. Type /models to see valid models.`,
          botToken,
          messageId
        );
        return;
      }

      await this.userPreferenceRepo.setPreferredModel('telegram', userId, targetModel.modelId);
      await this.telegramGateway.sendMessage(
        chatId,
        `✅ Switched model to *${targetModel.displayName}* (\`${targetModel.modelId}\`).`,
        botToken,
        messageId
      );
      return;
    }

    await this.telegramGateway.sendMessage(
      chatId,
      '❓ Unknown command. Type /help to see available commands.',
      botToken,
      messageId
    );
  }
}
