import { PrismaClient } from '@prisma/client';
import { BotChannel, BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import {
  IBotChannelRepository,
  UpdateBotChannelDto,
} from '../../domain/repositories/i-bot-channel.repository.js';

export class PrismaBotChannelRepository implements IBotChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPlatform(platform: BotPlatform): Promise<BotChannel | null> {
    const record = await this.prisma.botChannel.findUnique({
      where: { platform },
    });
    return (record as BotChannel) || null;
  }

  async findAll(): Promise<BotChannel[]> {
    const records = await this.prisma.botChannel.findMany({
      orderBy: { platform: 'asc' },
    });
    return records as BotChannel[];
  }

  async upsert(platform: BotPlatform, data: UpdateBotChannelDto): Promise<BotChannel> {
    const record = await this.prisma.botChannel.upsert({
      where: { platform },
      update: {
        ...(data.lineChannelSecret !== undefined && { lineChannelSecret: data.lineChannelSecret }),
        ...(data.lineAccessToken !== undefined && { lineAccessToken: data.lineAccessToken }),
        ...(data.telegramBotToken !== undefined && { telegramBotToken: data.telegramBotToken }),
        ...(data.telegramWebhookSecret !== undefined && {
          telegramWebhookSecret: data.telegramWebhookSecret,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.webhookUrl !== undefined && { webhookUrl: data.webhookUrl }),
        ...(data.lastVerifiedAt !== undefined && { lastVerifiedAt: data.lastVerifiedAt }),
        ...(data.botDisplayName !== undefined && { botDisplayName: data.botDisplayName }),
        ...(data.botAvatarUrl !== undefined && { botAvatarUrl: data.botAvatarUrl }),
      },
      create: {
        platform,
        lineChannelSecret: data.lineChannelSecret || null,
        lineAccessToken: data.lineAccessToken || null,
        telegramBotToken: data.telegramBotToken || null,
        telegramWebhookSecret: data.telegramWebhookSecret || null,
        isActive: data.isActive ?? false,
        webhookUrl: data.webhookUrl || null,
        lastVerifiedAt: data.lastVerifiedAt || null,
        botDisplayName: data.botDisplayName || null,
        botAvatarUrl: data.botAvatarUrl || null,
      },
    });
    return record as BotChannel;
  }
}
