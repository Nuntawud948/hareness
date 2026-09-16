import { PrismaClient } from '@prisma/client';
import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { PushLog, PushStatus } from '../../domain/entities/push-log.entity.js';
import {
  CreatePushLogDto,
  IPushLogRepository,
} from '../../domain/repositories/i-push-log.repository.js';

export class PrismaPushLogRepository implements IPushLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePushLogDto): Promise<PushLog> {
    const record = await this.prisma.pushMessageLog.create({
      data: {
        platform: data.platform,
        targetId: data.targetId,
        messageContent: data.messageContent,
        status: data.status,
        errorMessage: data.errorMessage || null,
        sourceTrigger: data.sourceTrigger || 'api',
      },
    });

    return {
      id: record.id,
      platform: record.platform as BotPlatform,
      targetId: record.targetId,
      messageContent: record.messageContent,
      status: record.status as PushStatus,
      errorMessage: record.errorMessage,
      sourceTrigger: record.sourceTrigger,
      createdAt: record.createdAt,
    };
  }

  async getRecentLogs(limit = 50): Promise<PushLog[]> {
    const records = await this.prisma.pushMessageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      platform: r.platform as BotPlatform,
      targetId: r.targetId,
      messageContent: r.messageContent,
      status: r.status as PushStatus,
      errorMessage: r.errorMessage,
      sourceTrigger: r.sourceTrigger,
      createdAt: r.createdAt,
    }));
  }

  async findByTarget(targetId: string, limit = 50): Promise<PushLog[]> {
    const records = await this.prisma.pushMessageLog.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      platform: r.platform as BotPlatform,
      targetId: r.targetId,
      messageContent: r.messageContent,
      status: r.status as PushStatus,
      errorMessage: r.errorMessage,
      sourceTrigger: r.sourceTrigger,
      createdAt: r.createdAt,
    }));
  }
}
