import { PrismaClient } from '@prisma/client';
import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { UserPreference } from '../../domain/entities/user-preference.entity.js';
import { IUserPreferenceRepository } from '../../domain/repositories/i-user-preference.repository.js';

export class PrismaUserPreferenceRepository implements IUserPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(platform: BotPlatform, userId: string): Promise<UserPreference | null> {
    const record = await this.prisma.userPreference.findUnique({
      where: {
        platform_userId: { platform, userId },
      },
    });
    return (record as UserPreference) || null;
  }

  async setPreferredModel(
    platform: BotPlatform,
    userId: string,
    model: string | null
  ): Promise<UserPreference> {
    const record = await this.prisma.userPreference.upsert({
      where: {
        platform_userId: { platform, userId },
      },
      update: {
        preferredModel: model,
      },
      create: {
        platform,
        userId,
        preferredModel: model,
      },
    });
    return record as UserPreference;
  }
}
