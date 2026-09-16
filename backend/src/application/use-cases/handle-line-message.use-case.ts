import { PrismaClient } from '@prisma/client';
import { ChannelNotConfiguredError, RateLimitExceededError } from '../../domain/errors/domain.error.js';
import { IAvailableModelRepository } from '../../domain/repositories/i-available-model.repository.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IConversationHistoryRepository } from '../../domain/repositories/i-conversation-history.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { ISystemPromptRepository } from '../../domain/repositories/i-system-prompt.repository.js';
import { IUserPreferenceRepository } from '../../domain/repositories/i-user-preference.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILineMessagingGateway } from '../../domain/services/i-messaging-gateway.js';
import { IRateLimiter } from '../../domain/services/i-rate-limiter.js';
import { RouteLLMQueryUseCase } from './route-llm-query.use-case.js';

export interface HandleLineMessageInput {
  replyToken: string;
  userId: string;
  userMessage: string;
}

export class HandleLineMessageUseCase {
  constructor(
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly conversationHistoryRepo: IConversationHistoryRepository,
    private readonly systemPromptRepo: ISystemPromptRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly availableModelRepo: IAvailableModelRepository,
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly rateLimiter: IRateLimiter,
    private readonly lineGateway: ILineMessagingGateway,
    private readonly routeLLMQueryUseCase: RouteLLMQueryUseCase,
    private readonly prisma?: PrismaClient
  ) {}

  async execute(input: HandleLineMessageInput): Promise<void> {
    const { replyToken, userId, userMessage } = input;
    const trimmedMessage = userMessage.trim();

    // 1. Fetch and validate LINE channel configuration
    const channel = await this.botChannelRepo.findByPlatform('line');
    if (!channel || !channel.isActive || !channel.lineAccessToken) {
      throw new ChannelNotConfiguredError('line');
    }

    const channelAccessToken = this.encryptionService.decrypt(channel.lineAccessToken);

    // 2. Check rate limit
    const rateResult = await this.rateLimiter.checkLimit(`line:${userId}`);
    if (!rateResult.allowed) {
      await this.lineGateway.replyMessage(
        replyToken,
        `⏳ ข้อความเข้าบ่อยเกินไป กรุณารอ ${rateResult.resetSeconds} วินาทีก่อนส่งข้อความใหม่อีกครั้ง`,
        channelAccessToken
      );
      throw new RateLimitExceededError(rateResult.resetSeconds);
    }

    // 3. Process commands
    if (trimmedMessage.startsWith('/')) {
      await this.handleCommand(trimmedMessage, userId, replyToken, channelAccessToken);
      return;
    }

    // 4. Regular chat processing
    const activePrompt = await this.systemPromptRepo.findActive();
    const systemPromptContent = activePrompt?.content;

    // Fetch conversation context (capped at 20 messages)
    const history = await this.conversationHistoryRepo.getRecentHistory('line', userId, 20);

    // Append current user message to conversation history
    await this.conversationHistoryRepo.appendMessage('line', userId, 'user', trimmedMessage);

    // Fetch today's / recent receipt bills for spending context
    let receiptsContext = '';
    if (this.prisma) {
      try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const bills: any[] = await (this.prisma as any).receiptBill.findMany({
          where: { platform: 'line', userId, createdAt: { gte: startOfMonth } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        if (bills.length > 0) {
          const totalMonth = bills.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
          receiptsContext = `\n\n[ข้อมูลบิลใบเสร็จที่บันทึกไว้ในระบบ Google Drive / Database ประจำเดือนนี้: ทั้งหมด ${bills.length} รายการ รวม ${totalMonth} บาท:\n` +
            bills.map((b: any) => `- วันที่ ${b.billDate ? new Date(b.billDate).toISOString().split('T')[0] : 'วันนี้'}: ${b.merchantName} ยอด ${b.totalAmount} ${b.currency} (หมวด ${b.category || 'ทั่วไป'}) [ดูรูปใน Drive: ${b.googleDriveViewUrl || 'มี'}]`).join('\n') +
            `\nคำสั่งสำคัญ: เมื่อเจ้านายถามยอดใช้จ่าย สรุปค่าใช้จ่าย หรือขอดูบิลใบเสร็จ ให้ตอบโดยนำข้อมูลบิลเหล่านี้มารวมและอ้างอิงตอบเจ้านายได้อย่างถูกต้องเสมอ!]`;
        }
      } catch (e) {
        console.warn('Could not fetch receipts for prompt context:', e);
      }
    }

    try {
      const completion = await this.routeLLMQueryUseCase.execute({
        platform: 'line',
        userId,
        messages: [
          ...history,
          { role: 'user', content: trimmedMessage }
        ],
        systemPrompt: (systemPromptContent || '') + receiptsContext,
      });

      // Append assistant answer to conversation history
      await this.conversationHistoryRepo.appendMessage('line', userId, 'assistant', completion.content);

      // Reply using free replyToken
      await this.lineGateway.replyMessage(replyToken, completion.content, channelAccessToken);
    } catch (err: any) {
      console.error('Error generating LINE reply:', err);
      await this.lineGateway.replyMessage(
        replyToken,
        '⚠️ ขออภัย ขณะนี้ระบบ AI ไม่สามารถตอบกลับได้ กรุณาลองใหม่อีกครั้งในภายหลัง',
        channelAccessToken
      );
    }
  }

  private async handleCommand(
    commandText: string,
    userId: string,
    replyToken: string,
    channelAccessToken: string
  ): Promise<void> {
    const parts = commandText.split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    if (command === '/help') {
      const helpText = [
        '📌 คำสั่งที่สามารถใช้งานได้:',
        '• /models - ดูรายชื่อโมเดล AI ทั้งหมดที่เปิดใช้งาน',
        '• /model <ชื่อโมเดล> - สลับโมเดล AI ที่ต้องการใช้',
        '• /model reset - กลับไปใช้โมเดลเริ่มต้นของระบบ',
        '• /clear หรือ /reset - ล้างบริบทประวัติบทสนทนา',
        '• /help - แสดงคำสั่งช่วยเหลือนี้'
      ].join('\n');
      await this.lineGateway.replyMessage(replyToken, helpText, channelAccessToken);
      return;
    }

    if (command === '/clear' || command === '/reset') {
      await this.conversationHistoryRepo.clearHistory('line', userId);
      await this.lineGateway.replyMessage(
        replyToken,
        '🧹 ล้างประวัติบทสนทนาเรียบร้อยแล้ว เริ่มต้นบทสนทนาใหม่ได้เลยครับ',
        channelAccessToken
      );
      return;
    }

    if (command === '/models') {
      const activeKeys = await this.providerKeyRepo.findActiveOrdered();
      if (activeKeys.length === 0) {
        await this.lineGateway.replyMessage(
          replyToken,
          '⚠️ ขณะนี้ยังไม่มีโมเดล AI ที่เปิดใช้งาน',
          channelAccessToken
        );
        return;
      }

      const pref = await this.userPreferenceRepo.findByUser('line', userId);
      const currentPref = pref?.preferredModel;

      const lines: string[] = ['🤖 รายชื่อโมเดล AI ที่พร้อมใช้งาน:'];
      for (const key of activeKeys) {
        lines.push(`\n[${key.displayName}]`);
        const models = await this.availableModelRepo.findByProviderId(key.id);
        for (const m of models) {
          const isSelected = currentPref === m.modelId ? ' (คุณกำลังใช้อยู่ ✅)' : '';
          lines.push(`• ${m.modelId} - ${m.displayName}${isSelected}`);
        }
      }
      lines.push('\nพิมพ์ `/model <ชื่อโมเดล>` เพื่อเปลี่ยนโมเดล');

      await this.lineGateway.replyMessage(replyToken, lines.join('\n'), channelAccessToken);
      return;
    }

    if (command === '/model') {
      if (!arg || arg.toLowerCase() === 'reset') {
        await this.userPreferenceRepo.setPreferredModel('line', userId, null);
        await this.lineGateway.replyMessage(
          replyToken,
          '🔄 รีเซ็ตการตั้งค่าโมเดลกลับสู่ค่าเริ่มต้นของระบบเรียบร้อยครับ',
          channelAccessToken
        );
        return;
      }

      const targetModel = await this.availableModelRepo.findByModelId(arg);
      if (!targetModel) {
        await this.lineGateway.replyMessage(
          replyToken,
          `❌ ไม่พบโมเดล '${arg}' กรุณาพิมพ์ /models เพื่อดูรายชื่อโมเดลที่ถูกต้อง`,
          channelAccessToken
        );
        return;
      }

      await this.userPreferenceRepo.setPreferredModel('line', userId, targetModel.modelId);
      await this.lineGateway.replyMessage(
        replyToken,
        `✅ เปลี่ยนโมเดลเป็น '${targetModel.displayName}' (${targetModel.modelId}) เรียบร้อยครับ`,
        channelAccessToken
      );
      return;
    }

    // Default unknown command
    await this.lineGateway.replyMessage(
      replyToken,
      '❓ ไม่รู้จักคำสั่งนี้ พิมพ์ /help เพื่อดูคำสั่งทั้งหมด',
      channelAccessToken
    );
  }
}
