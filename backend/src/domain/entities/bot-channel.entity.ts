export type BotPlatform = 'line' | 'telegram';

export interface BotChannel {
  id: string;
  platform: BotPlatform;
  lineChannelSecret?: string | null;
  lineAccessToken?: string | null;
  telegramBotToken?: string | null;
  telegramWebhookSecret?: string | null;
  isActive: boolean;
  webhookUrl?: string | null;
  lastVerifiedAt?: Date | null;
  botDisplayName?: string | null;
  botAvatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
