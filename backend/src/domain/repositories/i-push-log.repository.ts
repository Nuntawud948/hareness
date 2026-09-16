import { BotPlatform } from '../entities/bot-channel.entity.js';
import { PushLog, PushStatus } from '../entities/push-log.entity.js';

export interface CreatePushLogDto {
  platform: BotPlatform;
  targetId: string;
  messageContent: string;
  status: PushStatus;
  errorMessage?: string | null;
  sourceTrigger?: string;
}

export interface IPushLogRepository {
  create(data: CreatePushLogDto): Promise<PushLog>;
  getRecentLogs(limit?: number): Promise<PushLog[]>;
  findByTarget(targetId: string, limit?: number): Promise<PushLog[]>;
}
