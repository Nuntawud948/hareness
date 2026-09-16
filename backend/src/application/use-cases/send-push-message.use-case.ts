import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { ChannelNotConfiguredError } from '../../domain/errors/domain.error.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IPushLogRepository } from '../../domain/repositories/i-push-log.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILineMessagingGateway, ITelegramMessagingGateway } from '../../domain/services/i-messaging-gateway.js';

export interface SendPushMessageRequestDto {
  platform: BotPlatform;
  targetId: string;
  message: string;
  sourceTrigger?: string;
}

export interface SendPushMessageResponseDto {
  success: boolean;
  logId: string;
  platform: BotPlatform;
  targetId: string;
  error?: string;
}

export type PushEventCallback = (eventData: {
  id: string;
  platform: string;
  targetId: string;
  messageContent: string;
  status: string;
  errorMessage?: string | null;
  sourceTrigger: string;
  createdAt: Date;
}) => void;

export class SendPushMessageUseCase {
  private eventListeners: PushEventCallback[] = [];

  constructor(
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly pushLogRepo: IPushLogRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly lineGateway: ILineMessagingGateway,
    private readonly telegramGateway: ITelegramMessagingGateway
  ) {}

  onPushSent(listener: PushEventCallback): void {
    this.eventListeners.push(listener);
  }

  async execute(dto: SendPushMessageRequestDto): Promise<SendPushMessageResponseDto> {
    const { platform, targetId, message, sourceTrigger = 'api' } = dto;

    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let errorMessage: string | undefined = undefined;

    try {
      if (platform === 'line') {
        const channel = await this.botChannelRepo.findByPlatform('line');
        if (!channel || !channel.isActive || !channel.lineAccessToken) {
          throw new ChannelNotConfiguredError('line');
        }
        const token = this.encryptionService.decrypt(channel.lineAccessToken);
        await this.lineGateway.pushMessage(targetId, message, token);
      } else if (platform === 'telegram') {
        const channel = await this.botChannelRepo.findByPlatform('telegram');
        if (!channel || !channel.isActive || !channel.telegramBotToken) {
          throw new ChannelNotConfiguredError('telegram');
        }
        const token = this.encryptionService.decrypt(channel.telegramBotToken);
        await this.telegramGateway.sendMessage(targetId, message, token);
      } else {
        throw new Error(`Unsupported push platform: ${platform}`);
      }
    } catch (err: any) {
      status = 'FAILED';
      errorMessage = err.message || 'Push transmission failed';
    }

    const logRecord = await this.pushLogRepo.create({
      platform,
      targetId,
      messageContent: message,
      status,
      errorMessage,
      sourceTrigger,
    });

    // Notify all SSE watchers live
    for (const listener of this.eventListeners) {
      try {
        listener(logRecord);
      } catch (err) {
        console.error('Error notifying push event listener:', err);
      }
    }

    return {
      success: status === 'SUCCESS',
      logId: logRecord.id,
      platform,
      targetId,
      error: errorMessage,
    };
  }

  async getRecentLogs(limit = 50) {
    return this.pushLogRepo.getRecentLogs(limit);
  }
}
