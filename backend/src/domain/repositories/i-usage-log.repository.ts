import { BotPlatform } from '../entities/bot-channel.entity.js';
import { UsageLog } from '../entities/usage-log.entity.js';

export interface CreateUsageLogDto {
  platform: BotPlatform;
  userId: string;
  providerName: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  responseTimeMs?: number | null;
  wasFailover?: boolean;
}

export interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  providerBreakdown: Array<{
    providerName: string;
    requests: number;
    tokens: number;
    costUsd: number;
  }>;
  dailyStats: Array<{
    date: string;
    tokens: number;
    requests: number;
  }>;
}

export interface IUsageLogRepository {
  create(data: CreateUsageLogDto): Promise<UsageLog>;
  getSummary(days?: number): Promise<UsageSummary>;
  getRecentLogs(limit?: number): Promise<UsageLog[]>;
}
