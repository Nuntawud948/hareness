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

    // 3. Process commands & Rich Menu triggers
    if (
      trimmedMessage.startsWith('/') ||
      trimmedMessage === 'สรุปค่าใช้จ่ายเดือนนี้' ||
      trimmedMessage === 'สรุปค่าใช้จ่าย' ||
      trimmedMessage === 'สรุปยอดบิล' ||
      trimmedMessage === 'วิธีส่งบิลใบเสร็จ'
    ) {
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
        '📌 คำสั่งและเมนูที่สามารถใช้งานได้:',
        '• 📊 สรุปค่าใช้จ่าย หรือ /summary - ดูการ์ดสรุปยอดเงินประจำเดือน',
        '• 🧾 วิธีส่งบิลใบเสร็จ หรือ /guide - แนะนำวิธีส่งรูปบิลให้ AI อ่าน',
        '• 🤖 /models - ดูรายชื่อโมเดล AI ทั้งหมดที่เปิดใช้งาน',
        '• /model <ชื่อโมเดล> - สลับโมเดล AI ที่ต้องการใช้',
        '• /model reset - กลับไปใช้โมเดลเริ่มต้นของระบบ',
        '• 🧹 /clear หรือ /reset - ล้างบริบทประวัติบทสนทนา',
        '• /help - แสดงคำสั่งช่วยเหลือนี้'
      ].join('\n');
      await this.lineGateway.replyMessage(replyToken, helpText, channelAccessToken);
      return;
    }

    if (
      command === '/summary' ||
      command === 'สรุปค่าใช้จ่ายเดือนนี้' ||
      command === 'สรุปค่าใช้จ่าย' ||
      command === 'สรุปยอดบิล' ||
      commandText === 'สรุปค่าใช้จ่ายเดือนนี้' ||
      commandText === 'สรุปค่าใช้จ่าย' ||
      commandText === 'สรุปยอดบิล'
    ) {
      await this.handleMonthlySummary(userId, replyToken, channelAccessToken);
      return;
    }

    if (command === '/guide' || command === 'วิธีส่งบิลใบเสร็จ' || commandText === 'วิธีส่งบิลใบเสร็จ') {
      await this.handleReceiptGuide(replyToken, channelAccessToken);
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

  private async handleMonthlySummary(
    userId: string,
    replyToken: string,
    channelAccessToken: string
  ): Promise<void> {
    if (!this.prisma) {
      await this.lineGateway.replyMessage(replyToken, 'ระบบฐานข้อมูลไม่พร้อมใช้งาน', channelAccessToken);
      return;
    }

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const monthYearText = `${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

      const bills: any[] = await (this.prisma as any).receiptBill.findMany({
        where: {
          platform: 'line',
          userId,
          createdAt: { gte: startOfMonth },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch Google Drive folder URL
      let driveUrl = 'https://drive.google.com';
      try {
        const storageConfig = await (this.prisma as any).storageConfig.findUnique({
          where: { id: 'google_drive' },
        });
        if (storageConfig?.folderId) {
          driveUrl = `https://drive.google.com/drive/folders/${storageConfig.folderId}`;
        }
      } catch (e) {
        driveUrl = 'https://drive.google.com/drive/folders/1W_cu4ozE6wWUxdH3IOJ4SE4HXo5S2QHN';
      }

      if (bills.length === 0) {
        const emptyBubble = {
          type: 'bubble',
          size: 'mega',
          header: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '20px',
            backgroundColor: '#F8FAFC',
            contents: [
              {
                type: 'text',
                text: '📊 สรุปยอดค่าใช้จ่าย',
                weight: 'bold',
                size: 'md',
                color: '#0F172A',
              },
              {
                type: 'text',
                text: monthYearText,
                size: 'xs',
                color: '#64748B',
                margin: 'xs',
              },
            ],
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '20px',
            contents: [
              {
                type: 'text',
                text: 'ยังไม่มีการบันทึกบิลในเดือนนี้',
                weight: 'bold',
                size: 'sm',
                color: '#334155',
              },
              {
                type: 'text',
                text: 'ถ่ายรูปหรือเลือกรูปใบเสร็จส่งเข้ามาในแชทนี้ได้เลยครับ ระบบ AI จะสแกนและบันทึกภาพลง Google Drive ให้โดยอัตโนมัติ',
                size: 'xs',
                color: '#64748B',
                wrap: true,
                margin: 'md',
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#0D9488',
                action: {
                  type: 'uri',
                  label: '📂 เปิดดูโฟลเดอร์ Google Drive',
                  uri: driveUrl,
                },
              },
            ],
          },
        };

        await this.lineGateway.replyFlexMessage(
          replyToken,
          `📊 สรุปยอดเดือน ${monthYearText}: ยังไม่มีรายการบันทึก`,
          emptyBubble,
          channelAccessToken
        );
        return;
      }

      const totalAmount = bills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
      const totalAmountFormatted = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(totalAmount);

      // Group by category
      const categoryMap = new Map<string, number>();
      for (const bill of bills) {
        const cat = bill.category || 'ทั่วไป';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (bill.totalAmount || 0));
      }

      const categoryRows: any[] = [];
      categoryMap.forEach((catTotal, catName) => {
        categoryRows.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            {
              type: 'text',
              text: `• ${catName}`,
              size: 'xs',
              color: '#475569',
              flex: 1,
            },
            {
              type: 'text',
              text: `฿${catTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
              size: 'xs',
              color: '#0F172A',
              weight: 'bold',
              align: 'end',
            },
          ],
        });
      });

      // Top 3 latest bills
      const recentRows: any[] = [];
      bills.slice(0, 3).forEach((b: any) => {
        const dateStr = b.billDate
          ? new Date(b.billDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
          : new Date(b.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

        recentRows.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            {
              type: 'text',
              text: `${b.merchantName || 'ร้านค้าทั่วไป'} (${dateStr})`,
              size: 'xxs',
              color: '#64748B',
              flex: 1,
              maxLines: 1,
            },
            {
              type: 'text',
              text: `฿${(b.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
              size: 'xxs',
              color: '#0F172A',
              align: 'end',
            },
          ],
        });
      });

      const summaryBubble = {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '20px',
          backgroundColor: '#F8FAFC',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📊 สรุปยอดค่าใช้จ่าย',
                  weight: 'bold',
                  size: 'md',
                  color: '#0F172A',
                  flex: 1,
                },
                {
                  type: 'text',
                  text: monthYearText,
                  size: 'xs',
                  color: '#64748B',
                  align: 'end',
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              contents: [
                {
                  type: 'text',
                  text: 'ยอดรวมประจำเดือน',
                  size: 'xs',
                  color: '#64748B',
                },
                {
                  type: 'text',
                  text: `฿${totalAmountFormatted}`,
                  size: 'xxl',
                  weight: 'bold',
                  color: '#0D9488',
                  margin: 'xs',
                },
                {
                  type: 'text',
                  text: `บันทึกแล้วทั้งหมด ${bills.length} รายการ (Google Drive Synced)`,
                  size: 'xxs',
                  color: '#94A3B8',
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '20px',
          contents: [
            {
              type: 'text',
              text: 'หมวดหมู่ค่าใช้จ่าย',
              size: 'xs',
              weight: 'bold',
              color: '#334155',
            },
            ...categoryRows,
            {
              type: 'separator',
              margin: 'lg',
            },
            {
              type: 'text',
              text: 'รายการล่าสุด',
              size: 'xs',
              weight: 'bold',
              color: '#334155',
              margin: 'lg',
            },
            ...recentRows,
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#0D9488',
              action: {
                type: 'uri',
                label: '📂 ดูรูปใบเสร็จทั้งหมดใน Google Drive',
                uri: driveUrl,
              },
            },
          ],
        },
      };

      await this.lineGateway.replyFlexMessage(
        replyToken,
        `📊 สรุปยอดค่าใช้จ่าย ${monthYearText}: รวม ฿${totalAmountFormatted}`,
        summaryBubble,
        channelAccessToken
      );
    } catch (error: any) {
      console.error('Error generating monthly summary flex message:', error);
      await this.lineGateway.replyMessage(
        replyToken,
        '⚠️ ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลสรุปค่าใช้จ่าย กรุณาลองใหม่อีกครั้ง',
        channelAccessToken
      );
    }
  }

  private async handleReceiptGuide(replyToken: string, channelAccessToken: string): Promise<void> {
    const guideText = [
      '🧾 ขั้นตอนการส่งบิล/ใบเสร็จให้ระบบบันทึก:',
      '',
      '1. 📸 ถ่ายรูปหรือเลือกรูปใบเสร็จส่งเข้ามาในแชทนี้ได้ทันที',
      '2. 🤖 AI Vision จะสแกนข้อมูลอัตโนมัติ:',
      '   • ชื่อร้านค้า (Merchant)',
      '   • ยอดเงินรวมสุทธิ (Total Amount)',
      '   • หมวดหมู่ค่าใช้จ่าย (Category)',
      '   • วันที่ตามใบเสร็จ (Bill Date)',
      '3. ☁️ บันทึกไฟล์ภาพต้นฉบับลง Google Drive (โฟลเดอร์ Receipt_Bills) พร้อมลงฐานข้อมูล Neon DB ทันที',
      '4. 📊 สามารถกดปุ่ม "สรุปค่าใช้จ่าย" หรือพิมพ์ถามเลขา AI เพื่อดูรายงานได้ตลอดเวลาครับ!'
    ].join('\n');

    await this.lineGateway.replyMessage(replyToken, guideText, channelAccessToken);
  }
}
