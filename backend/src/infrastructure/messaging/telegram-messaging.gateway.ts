import { ITelegramMessagingGateway } from '../../domain/services/i-messaging-gateway.js';

export class TelegramMessagingGateway implements ITelegramMessagingGateway {
  private splitMessage(text: string, maxChunkSize = 4000): string[] {
    if (!text) return [''];
    if (text.length <= maxChunkSize) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxChunkSize) {
        chunks.push(remaining);
        break;
      }

      let splitIndex = remaining.lastIndexOf('\n', maxChunkSize);
      if (splitIndex <= 0 || splitIndex < maxChunkSize * 0.7) {
        splitIndex = remaining.lastIndexOf(' ', maxChunkSize);
      }
      if (splitIndex <= 0 || splitIndex < maxChunkSize * 0.7) {
        splitIndex = maxChunkSize;
      }

      chunks.push(remaining.slice(0, splitIndex).trim());
      remaining = remaining.slice(splitIndex).trim();
    }

    return chunks;
  }

  async sendMessage(
    chatId: string,
    text: string,
    botToken: string,
    replyToMessageId?: number
  ): Promise<void> {
    const chunks = this.splitMessage(text);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload: Record<string, any> = {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      };

      // Only attach reply_to_message_id to the first chunk
      if (i === 0 && replyToMessageId) {
        payload.reply_to_message_id = replyToMessageId;
      }

      let response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // If Markdown parsing fails due to unescaped characters, retry without parse_mode
      if (!response.ok) {
        const errText = await response.text();
        if (errText.includes('can\'t parse entities') || errText.includes('entity')) {
          delete payload.parse_mode;
          response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        if (!response.ok) {
          throw new Error(`Telegram sendMessage failed (${response.status}): ${errText}`);
        }
      }
    }
  }

  async verifyCredentials(botToken: string): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `HTTP ${response.status}: ${errText}` };
      }

      const data = (await response.json()) as {
        ok: boolean;
        result?: {
          first_name?: string;
          username?: string;
        };
      };

      if (!data.ok || !data.result) {
        return { ok: false, error: 'Telegram token verification returned not ok' };
      }

      const botName = data.result.username
        ? `@${data.result.username}`
        : data.result.first_name || 'Telegram Bot';

      return {
        ok: true,
        botName,
      };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection to Telegram failed' };
    }
  }
}
