import { BotPlatform } from './bot-channel.entity.js';

export interface UserPreference {
  id: string;
  platform: BotPlatform;
  userId: string;
  preferredModel?: string | null;
  updatedAt: Date;
}
