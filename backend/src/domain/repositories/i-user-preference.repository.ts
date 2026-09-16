import { BotPlatform } from '../entities/bot-channel.entity.js';
import { UserPreference } from '../entities/user-preference.entity.js';

export interface IUserPreferenceRepository {
  findByUser(platform: BotPlatform, userId: string): Promise<UserPreference | null>;
  setPreferredModel(platform: BotPlatform, userId: string, model: string | null): Promise<UserPreference>;
}
