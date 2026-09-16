import { describe, expect, it } from 'vitest';
import { LineMessagingGateway } from '../../src/infrastructure/messaging/line-messaging.gateway.js';
import { TelegramMessagingGateway } from '../../src/infrastructure/messaging/telegram-messaging.gateway.js';

describe('Text Chunking Logic', () => {
  it('should split long messages for LINE into max 5 bubbles', () => {
    const gateway = new LineMessagingGateway();
    // Private method test via prototype/cast
    const splitFn = (gateway as any).splitMessage.bind(gateway);

    // Short message: exactly 1 chunk
    expect(splitFn('Hello world', 4500, 5)).toEqual(['Hello world']);

    // Long message > 10,000 chars
    const longText = 'A'.repeat(12000);
    const chunks = splitFn(longText, 4500, 5);

    expect(chunks.length).toBeLessThanOrEqual(5);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4500);
    }

    // Huge message > 30,000 chars (exceeds 5 bubbles)
    const hugeText = 'B'.repeat(30000);
    const hugeChunks = splitFn(hugeText, 4500, 5);
    expect(hugeChunks.length).toBe(5);
    expect(hugeChunks[4]).toContain('ข้อความยาวเกินกำหนด');
  });

  it('should split long messages for Telegram into chunks <= 4000 characters', () => {
    const gateway = new TelegramMessagingGateway();
    const splitFn = (gateway as any).splitMessage.bind(gateway);

    const longText = 'Hello Telegram\n'.repeat(500); // approx 7500 chars
    const chunks = splitFn(longText, 4000);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
  });
});
