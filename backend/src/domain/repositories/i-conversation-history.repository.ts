import { BotPlatform } from '../entities/bot-channel.entity.js';
import { ChatMessage, ChatRole } from '../entities/chat-message.entity.js';

export interface IConversationHistoryRepository {
  getRecentHistory(platform: BotPlatform, sessionId: string, limit?: number): Promise<ChatMessage[]>;
  appendMessage(platform: BotPlatform, sessionId: string, role: ChatRole, content: string): Promise<ChatMessage>;
  clearHistory(platform: BotPlatform, sessionId: string): Promise<void>;
  pruneOldHistory(days: number): Promise<number>;
}
