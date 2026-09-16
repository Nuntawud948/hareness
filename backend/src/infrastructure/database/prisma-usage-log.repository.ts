import { PrismaClient } from '@prisma/client';
import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { UsageLog } from '../../domain/entities/usage-log.entity.js';
import {
  CreateUsageLogDto,
  IUsageLogRepository,
  UsageSummary,
} from '../../domain/repositories/i-usage-log.repository.js';

export class PrismaUsageLogRepository implements IUsageLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUsageLogDto): Promise<UsageLog> {
    const record = await this.prisma.usageLog.create({
      data: {
        platform: data.platform,
        userId: data.userId,
        providerName: data.providerName,
        modelId: data.modelId,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        estimatedCostUsd: data.estimatedCostUsd || 0,
        responseTimeMs: data.responseTimeMs || null,
        wasFailover: data.wasFailover || false,
      },
    });

    return {
      id: record.id,
      platform: record.platform as BotPlatform,
      userId: record.userId,
      providerName: record.providerName,
      modelId: record.modelId,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      estimatedCostUsd: record.estimatedCostUsd,
      responseTimeMs: record.responseTimeMs,
      wasFailover: record.wasFailover,
      createdAt: record.createdAt,
    };
  }

  async getSummary(days = 30): Promise<UsageSummary> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const logs = await this.prisma.usageLog.findMany({
      where: {
        createdAt: {
          gte: cutoffDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let estimatedCostUsd = 0;

    const providerMap = new Map<
      string,
      { requests: number; tokens: number; costUsd: number }
    >();

    const dailyMap = new Map<string, { tokens: number; requests: number }>();

    for (const log of logs) {
      totalTokens += log.totalTokens;
      promptTokens += log.promptTokens;
      completionTokens += log.completionTokens;
      estimatedCostUsd += log.estimatedCostUsd;

      // Provider breakdown
      const p = providerMap.get(log.providerName) || { requests: 0, tokens: 0, costUsd: 0 };
      p.requests += 1;
      p.tokens += log.totalTokens;
      p.costUsd += log.estimatedCostUsd;
      providerMap.set(log.providerName, p);

      // Daily breakdown (YYYY-MM-DD)
      const dayKey = log.createdAt.toISOString().slice(0, 10);
      const d = dailyMap.get(dayKey) || { tokens: 0, requests: 0 };
      d.requests += 1;
      d.tokens += log.totalTokens;
      dailyMap.set(dayKey, d);
    }

    const providerBreakdown = Array.from(providerMap.entries()).map(([providerName, stats]) => ({
      providerName,
      requests: stats.requests,
      tokens: stats.tokens,
      costUsd: Number(stats.costUsd.toFixed(4)),
    }));

    const dailyStats = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      tokens: stats.tokens,
      requests: stats.requests,
    }));

    return {
      totalRequests: logs.length,
      totalTokens,
      promptTokens,
      completionTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      providerBreakdown,
      dailyStats,
    };
  }

  async getRecentLogs(limit = 50): Promise<UsageLog[]> {
    const records = await this.prisma.usageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      platform: r.platform as BotPlatform,
      userId: r.userId,
      providerName: r.providerName,
      modelId: r.modelId,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      estimatedCostUsd: r.estimatedCostUsd,
      responseTimeMs: r.responseTimeMs,
      wasFailover: r.wasFailover,
      createdAt: r.createdAt,
    }));
  }
}
