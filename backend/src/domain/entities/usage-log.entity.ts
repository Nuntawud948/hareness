import { BotPlatform } from './bot-channel.entity.js';

export interface UsageLog {
  id: string;
  platform: BotPlatform;
  userId: string;
  providerName: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  responseTimeMs?: number | null;
  wasFailover: boolean;
  createdAt: Date;
}
