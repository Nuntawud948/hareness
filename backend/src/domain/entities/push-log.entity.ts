import { BotPlatform } from './bot-channel.entity.js';

export type PushStatus = 'SUCCESS' | 'FAILED';

export interface PushLog {
  id: string;
  platform: BotPlatform;
  targetId: string;
  messageContent: string;
  status: PushStatus;
  errorMessage?: string | null;
  sourceTrigger: string;
  createdAt: Date;
}
