import { PrismaClient } from '@prisma/client';
import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { ChatMessage, ChatRole } from '../../domain/entities/chat-message.entity.js';
import { IConversationHistoryRepository } from '../../domain/repositories/i-conversation-history.repository.js';

export class PrismaConversationHistoryRepository implements IConversationHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getRecentHistory(platform: BotPlatform, sessionId: string, limit = 20): Promise<ChatMessage[]> {
    const records = await this.prisma.conversationHistory.findMany({
      where: { platform, sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Reverse to chronological order (oldest to newest)
    records.reverse();

    return records.map((r) => ({
      id: r.id,
      role: r.role as ChatRole,
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  async appendMessage(
    platform: BotPlatform,
    sessionId: string,
    role: ChatRole,
    content: string
  ): Promise<ChatMessage> {
    const record = await this.prisma.conversationHistory.create({
      data: {
        platform,
        sessionId,
        role,
        content,
      },
    });

    return {
      id: record.id,
      role: record.role as ChatRole,
      content: record.content,
      createdAt: record.createdAt,
    };
  }

  async clearHistory(platform: BotPlatform, sessionId: string): Promise<void> {
    await this.prisma.conversationHistory.deleteMany({
      where: { platform, sessionId },
    });
  }

  async pruneOldHistory(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.conversationHistory.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
