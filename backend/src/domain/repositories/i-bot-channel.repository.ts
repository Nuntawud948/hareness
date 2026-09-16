import { BotChannel, BotPlatform } from '../entities/bot-channel.entity.js';

export interface UpdateBotChannelDto {
  lineChannelSecret?: string | null;
  lineAccessToken?: string | null;
  telegramBotToken?: string | null;
  telegramWebhookSecret?: string | null;
  discordBotToken?: string | null;
  discordApplicationId?: string | null;
  isActive?: boolean;
  webhookUrl?: string | null;
  lastVerifiedAt?: Date | null;
  botDisplayName?: string | null;
  botAvatarUrl?: string | null;
}

export interface IBotChannelRepository {
  findByPlatform(platform: BotPlatform): Promise<BotChannel | null>;
  findAll(): Promise<BotChannel[]>;
  upsert(platform: BotPlatform, data: UpdateBotChannelDto): Promise<BotChannel>;
}
