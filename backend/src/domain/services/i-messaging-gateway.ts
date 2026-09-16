export interface ILineMessagingGateway {
  replyMessage(replyToken: string, text: string, channelAccessToken: string): Promise<void>;
  pushMessage(toUserId: string, text: string, channelAccessToken: string): Promise<void>;
  getMessageContent(messageId: string, channelAccessToken: string): Promise<Buffer>;
  verifySignature(rawBody: string, signature: string, channelSecret: string): boolean;
  verifyCredentials(channelSecret: string, channelAccessToken: string): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    error?: string;
  }>;
}

export interface ITelegramMessagingGateway {
  sendMessage(chatId: string, text: string, botToken: string, replyToMessageId?: number): Promise<void>;
  verifyCredentials(botToken: string): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    error?: string;
  }>;
}
