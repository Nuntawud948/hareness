import crypto from 'crypto';
import { ILineMessagingGateway } from '../../domain/services/i-messaging-gateway.js';

export class LineMessagingGateway implements ILineMessagingGateway {
  /**
   * Split long text into chunks that fit into LINE's replyMessage limit.
   * LINE allows up to 5 message bubbles per reply, each up to 5,000 characters.
   */
  private splitMessage(text: string, maxChunkSize = 4500, maxBubbles = 5): string[] {
    if (!text) return [''];
    if (text.length <= maxChunkSize) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0 && chunks.length < maxBubbles) {
      if (chunks.length === maxBubbles - 1 && remaining.length > maxChunkSize) {
        // Last available bubble: truncate with note
        chunks.push(remaining.slice(0, maxChunkSize - 30) + '\n...(ข้อความยาวเกินกำหนด)');
        break;
      }

      if (remaining.length <= maxChunkSize) {
        chunks.push(remaining);
        break;
      }

      // Try to break at a newline or space if possible
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

  async replyMessage(replyToken: string, text: string, channelAccessToken: string): Promise<void> {
    const textChunks = this.splitMessage(text);
    const messages = textChunks.map((chunk) => ({
      type: 'text',
      text: chunk,
    }));

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LINE replyMessage failed (${response.status}): ${errBody}`);
    }
  }

  async replyFlexMessage(
    replyToken: string,
    altText: string,
    flexContainer: any,
    channelAccessToken: string
  ): Promise<void> {
    const messages = [
      {
        type: 'flex',
        altText: altText || 'สรุปข้อมูลค่าใช้จ่าย',
        contents: flexContainer,
      },
    ];

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LINE replyFlexMessage failed (${response.status}): ${errBody}`);
    }
  }

  async pushMessage(toUserId: string, text: string, channelAccessToken: string): Promise<void> {
    const textChunks = this.splitMessage(text);
    const messages = textChunks.map((chunk) => ({
      type: 'text',
      text: chunk,
    }));

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LINE pushMessage failed (${response.status}): ${errBody}`);
    }
  }

  async getMessageContent(messageId: string, channelAccessToken: string): Promise<Buffer> {
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LINE getMessageContent failed (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  verifySignature(rawBody: string, signature: string, channelSecret: string): boolean {
    if (!signature || !channelSecret) return false;

    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(rawBody)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async verifyCredentials(
    channelSecret: string,
    channelAccessToken: string
  ): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('https://api.line.me/v2/bot/info', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `HTTP ${response.status}: ${errText}` };
      }

      const data = (await response.json()) as {
        displayName?: string;
        pictureUrl?: string;
      };

      return {
        ok: true,
        botName: data.displayName || 'LINE Bot',
        botAvatarUrl: data.pictureUrl,
      };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection to LINE failed' };
    }
  }
}
