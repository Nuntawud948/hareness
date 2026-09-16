import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import {
  ILineMessagingGateway,
  ITelegramMessagingGateway,
  IDiscordMessagingGateway,
} from '../../domain/services/i-messaging-gateway.js';

export interface UpdateBotChannelRequestDto {
  lineChannelSecret?: string;
  lineAccessToken?: string;
  telegramBotToken?: string;
  telegramWebhookSecret?: string;
  discordBotToken?: string;
  discordApplicationId?: string;
  isActive?: boolean;
}

export interface BotChannelResponseDto {
  id: string;
  platform: BotPlatform;
  hasLineChannelSecret: boolean;
  hasLineAccessToken: boolean;
  hasTelegramBotToken: boolean;
  hasDiscordBotToken: boolean;
  maskedLineChannelSecret?: string;
  maskedLineAccessToken?: string;
  maskedTelegramBotToken?: string;
  maskedDiscordBotToken?: string;
  discordApplicationId?: string | null;
  isActive: boolean;
  webhookUrl: string;
  lastVerifiedAt?: Date | null;
  botDisplayName?: string | null;
  botAvatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ManageBotChannelsUseCase {
  constructor(
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly lineGateway: ILineMessagingGateway,
    private readonly telegramGateway: ITelegramMessagingGateway,
    private readonly discordGateway?: IDiscordMessagingGateway
  ) {}

  async getAll(serverBaseUrl: string): Promise<BotChannelResponseDto[]> {
    const channels = await this.botChannelRepo.findAll();
    const result: BotChannelResponseDto[] = [];

    const platforms: BotPlatform[] = ['line', 'telegram', 'discord'];

    for (const platform of platforms) {
      let ch = channels.find((c) => c.platform === platform);
      if (!ch) {
        // Initialize placeholder record if not present
        ch = await this.botChannelRepo.upsert(platform, { isActive: false });
      }

      const hasLineSecret = Boolean(ch.lineChannelSecret && ch.lineChannelSecret.length > 0);
      const hasLineToken = Boolean(ch.lineAccessToken && ch.lineAccessToken.length > 0);
      const hasTelegramToken = Boolean(ch.telegramBotToken && ch.telegramBotToken.length > 0);

      let maskedLineSecret: string | undefined;
      let maskedLineToken: string | undefined;
      let maskedTgToken: string | undefined;

      if (hasLineSecret) {
        try {
          const dec = this.encryptionService.decrypt(ch.lineChannelSecret!);
          maskedLineSecret = this.encryptionService.mask(dec);
        } catch {
          maskedLineSecret = '****[Decryption Error]';
        }
      }

      if (hasLineToken) {
        try {
          const dec = this.encryptionService.decrypt(ch.lineAccessToken!);
          maskedLineToken = this.encryptionService.mask(dec);
        } catch {
          maskedLineToken = '****[Decryption Error]';
        }
      }

      if (hasTelegramToken) {
        try {
          const dec = this.encryptionService.decrypt(ch.telegramBotToken!);
          maskedTgToken = this.encryptionService.mask(dec);
        } catch {
          maskedTgToken = '****[Decryption Error]';
        }
      }

      const hasDiscordToken = Boolean(ch.discordBotToken && ch.discordBotToken.length > 0);
      let maskedDiscordToken: string | undefined;
      if (hasDiscordToken) {
        try {
          const dec = this.encryptionService.decrypt(ch.discordBotToken!);
          maskedDiscordToken = this.encryptionService.mask(dec);
        } catch {
          maskedDiscordToken = '****[Decryption Error]';
        }
      }

      const webhookPath =
        platform === 'line'
          ? '/webhook/line'
          : platform === 'telegram'
          ? '/webhook/telegram'
          : '/gateway/discord';
      const cleanBase = serverBaseUrl.endsWith('/') ? serverBaseUrl.slice(0, -1) : serverBaseUrl;
      const fullWebhookUrl = `${cleanBase}${webhookPath}`;

      result.push({
        id: ch.id,
        platform,
        hasLineChannelSecret: hasLineSecret,
        hasLineAccessToken: hasLineToken,
        hasTelegramBotToken: hasTelegramToken,
        hasDiscordBotToken: hasDiscordToken,
        maskedLineChannelSecret: maskedLineSecret,
        maskedLineAccessToken: maskedLineToken,
        maskedTelegramBotToken: maskedTgToken,
        maskedDiscordBotToken: maskedDiscordToken,
        discordApplicationId: ch.discordApplicationId,
        isActive: ch.isActive,
        webhookUrl: fullWebhookUrl,
        lastVerifiedAt: ch.lastVerifiedAt,
        botDisplayName: ch.botDisplayName,
        botAvatarUrl: ch.botAvatarUrl,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      });
    }

    return result;
  }

  async updateLineChannel(data: {
    lineChannelSecret?: string;
    lineAccessToken?: string;
    isActive?: boolean;
  }): Promise<void> {
    let lineChannelSecret: string | undefined = undefined;
    let lineAccessToken: string | undefined = undefined;

    if (data.lineChannelSecret && data.lineChannelSecret.trim().length > 0) {
      lineChannelSecret = this.encryptionService.encrypt(data.lineChannelSecret.trim());
    }

    if (data.lineAccessToken && data.lineAccessToken.trim().length > 0) {
      lineAccessToken = this.encryptionService.encrypt(data.lineAccessToken.trim());
    }

    await this.botChannelRepo.upsert('line', {
      lineChannelSecret,
      lineAccessToken,
      isActive: data.isActive,
    });
  }

  async updateTelegramChannel(data: {
    telegramBotToken?: string;
    telegramWebhookSecret?: string;
    isActive?: boolean;
  }): Promise<void> {
    let telegramBotToken: string | undefined = undefined;
    let telegramWebhookSecret: string | undefined = undefined;

    if (data.telegramBotToken && data.telegramBotToken.trim().length > 0) {
      telegramBotToken = this.encryptionService.encrypt(data.telegramBotToken.trim());
    }

    if (data.telegramWebhookSecret && data.telegramWebhookSecret.trim().length > 0) {
      telegramWebhookSecret = data.telegramWebhookSecret.trim();
    }

    await this.botChannelRepo.upsert('telegram', {
      telegramBotToken,
      telegramWebhookSecret,
      isActive: data.isActive,
    });
  }

  async updateDiscordChannel(data: {
    discordBotToken?: string;
    discordApplicationId?: string;
    isActive?: boolean;
  }): Promise<void> {
    let discordBotToken: string | undefined = undefined;
    let discordApplicationId: string | undefined = undefined;

    if (data.discordBotToken && data.discordBotToken.trim().length > 0) {
      discordBotToken = this.encryptionService.encrypt(data.discordBotToken.trim());
    }

    if (data.discordApplicationId !== undefined) {
      discordApplicationId = data.discordApplicationId.trim() || undefined;
    }

    await this.botChannelRepo.upsert('discord', {
      discordBotToken,
      discordApplicationId,
      isActive: data.isActive,
    });
  }

  async verifyChannel(platform: BotPlatform): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    error?: string;
  }> {
    const ch = await this.botChannelRepo.findByPlatform(platform);
    if (!ch) {
      return { ok: false, error: `Channel '${platform}' is not configured.` };
    }

    if (platform === 'line') {
      if (!ch.lineChannelSecret || !ch.lineAccessToken) {
        return { ok: false, error: 'LINE Channel Secret or Access Token is missing.' };
      }

      let secret = '';
      let token = '';
      try {
        secret = this.encryptionService.decrypt(ch.lineChannelSecret);
        token = this.encryptionService.decrypt(ch.lineAccessToken);
      } catch (err: any) {
        return { ok: false, error: `Decryption error: ${err.message}` };
      }

      const check = await this.lineGateway.verifyCredentials(secret, token);
      if (check.ok) {
        await this.botChannelRepo.upsert('line', {
          lastVerifiedAt: new Date(),
          botDisplayName: check.botName || 'LINE Bot',
          botAvatarUrl: check.botAvatarUrl || null,
        });
      }
      return check;
    }

    if (platform === 'telegram') {
      if (!ch.telegramBotToken) {
        return { ok: false, error: 'Telegram Bot Token is missing.' };
      }

      let token = '';
      try {
        token = this.encryptionService.decrypt(ch.telegramBotToken);
      } catch (err: any) {
        return { ok: false, error: `Decryption error: ${err.message}` };
      }

      const check = await this.telegramGateway.verifyCredentials(token);
      if (check.ok) {
        await this.botChannelRepo.upsert('telegram', {
          lastVerifiedAt: new Date(),
          botDisplayName: check.botName || 'Telegram Bot',
          botAvatarUrl: check.botAvatarUrl || null,
        });
      }
      return check;
    }

    if (platform === 'discord') {
      if (!ch.discordBotToken) {
        return { ok: false, error: 'Discord Bot Token is missing.' };
      }
      if (!this.discordGateway) {
        return { ok: false, error: 'Discord Gateway service is not initialized.' };
      }

      let token = '';
      try {
        token = this.encryptionService.decrypt(ch.discordBotToken);
      } catch (err: any) {
        return { ok: false, error: `Decryption error: ${err.message}` };
      }

      const check = await this.discordGateway.verifyCredentials(token);
      if (check.ok) {
        await this.botChannelRepo.upsert('discord', {
          lastVerifiedAt: new Date(),
          botDisplayName: check.botName || 'Discord Bot',
          botAvatarUrl: check.botAvatarUrl || null,
          ...(check.botId && !ch.discordApplicationId ? { discordApplicationId: check.botId } : {}),
        });
      }
      return check;
    }

    return { ok: false, error: `Unsupported platform: ${platform}` };
  }
}
