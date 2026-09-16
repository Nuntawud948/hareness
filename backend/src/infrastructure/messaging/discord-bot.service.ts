import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { IDiscordMessagingGateway } from '../../domain/services/i-messaging-gateway.js';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { IConversationHistoryRepository } from '../../domain/repositories/i-conversation-history.repository.js';
import { ISystemPromptRepository } from '../../domain/repositories/i-system-prompt.repository.js';
import { IUserPreferenceRepository } from '../../domain/repositories/i-user-preference.repository.js';
import { IAvailableModelRepository } from '../../domain/repositories/i-available-model.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { IStorageService } from '../../domain/services/i-storage.service.js';
import { RouteLLMQueryUseCase } from '../../application/use-cases/route-llm-query.use-case.js';
import { GeminiVisionReceiptScanner, ParsedReceiptData } from '../llm/gemini-vision.service.js';

export class DiscordBotService implements IDiscordMessagingGateway {
  private client: Client | null = null;
  private isConnecting = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly conversationHistoryRepo: IConversationHistoryRepository,
    private readonly systemPromptRepo: ISystemPromptRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly availableModelRepo: IAvailableModelRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly storageService: IStorageService,
    private readonly visionScanner: GeminiVisionReceiptScanner,
    private readonly routeLLMQueryUseCase: RouteLLMQueryUseCase
  ) {}

  async verifyCredentials(botToken: string): Promise<{
    ok: boolean;
    botName?: string;
    botAvatarUrl?: string;
    botId?: string;
    error?: string;
  }> {
    if (!botToken) {
      return { ok: false, error: 'Discord Bot Token is empty.' };
    }

    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `Discord authentication failed (${res.status}): ${errText}` };
      }

      const data = (await res.json()) as any;
      const avatarUrl = data.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(data.discriminator || '0', 10) % 5}.png`;

      return {
        ok: true,
        botName: data.username,
        botAvatarUrl: avatarUrl,
        botId: data.id,
      };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to connect to Discord API.' };
    }
  }

  async start(botToken: string): Promise<void> {
    if (this.client) {
      await this.stop();
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel],
      });

      this.client.once('ready', () => {
        console.log(`🤖 Discord Bot connected as ${this.client?.user?.tag} (${this.client?.user?.id})`);
        this.isConnecting = false;
      });

      this.client.on('messageCreate', async (message: Message) => {
        await this.handleMessage(message);
      });

      await this.client.login(botToken);
    } catch (err) {
      this.isConnecting = false;
      console.error('Failed to start Discord Bot client:', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.warn('Error destroying Discord client:', err);
      }
      this.client = null;
    }
    this.isConnecting = false;
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const isMentioned = this.client?.user ? message.mentions.has(this.client.user.id) : false;

    // Only respond to DMs or direct mentions in guild channels
    if (!isDM && !isMentioned) {
      return;
    }

    const userId = message.author.id;
    let text = message.content;

    // Remove bot mention from content
    if (this.client?.user) {
      const mentionRegex = new RegExp(`<@!?${this.client.user.id}>`, 'g');
      text = text.replace(mentionRegex, '').trim();
    }

    // 1. Check for Image Attachments (Receipt OCR)
    const imageAttachment = message.attachments.find((att) => {
      const ct = att.contentType || '';
      return (
        ct.startsWith('image/') ||
        att.name.endsWith('.jpg') ||
        att.name.endsWith('.jpeg') ||
        att.name.endsWith('.png') ||
        att.name.endsWith('.webp')
      );
    });

    if (imageAttachment) {
      await this.handleReceiptAttachment(message, imageAttachment.url);
      return;
    }

    if (!text && message.attachments.size > 0) {
      await message.reply('📸 หากต้องการให้เลขาบันทึกใบเสร็จ กรุณาแนบไฟล์รูปภาพ (.jpg, .png) นะคะ');
      return;
    }

    if (!text) return;

    // 2. Commands & Quick Triggers
    const trimmed = text.trim();
    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    if (command === '/help' || command === 'help' || trimmed === 'วิธีใช้' || trimmed === 'คู่มือ') {
      await this.sendHelpEmbed(message);
      return;
    }

    if (command === '/clear' || command === '/reset' || trimmed === 'ล้างประวัติ' || trimmed === 'คุยใหม่') {
      await this.conversationHistoryRepo.clearHistory('discord', userId);
      const embed = new EmbedBuilder()
        .setColor(0x0d9488)
        .setTitle('🧹 ล้างประวัติบทสนทนาเรียบร้อยค่ะ')
        .setDescription('ความจำในบทสนทนานี้ถูกรีเซ็ตแล้ว เจ้านายสามารถเริ่มต้นคุยเรื่องใหม่ได้เลยนะคะ')
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === '/models' || trimmed === 'ดูโมเดล' || trimmed === 'โมเดล') {
      await this.sendModelsEmbed(message, userId);
      return;
    }

    if (command === '/model') {
      await this.handleModelSwitch(message, userId, arg);
      return;
    }

    if (
      command === '/summary' ||
      trimmed === 'สรุปค่าใช้จ่าย' ||
      trimmed === 'สรุปค่าใช้จ่ายเดือนนี้' ||
      trimmed === 'สรุปยอดบิล'
    ) {
      await this.sendSummaryEmbed(message, userId);
      return;
    }

    // 3. Regular AI Chat Response
    await this.processAIChat(message, userId, trimmed);
  }

  private async handleReceiptAttachment(message: Message, imageUrl: string): Promise<void> {
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Download image buffer
      const res = await fetch(imageUrl);
      if (!res.ok) {
        await message.reply('❌ ไม่สามารถดาวน์โหลดรูปภาพจาก Discord ได้ค่ะ');
        return;
      }
      const imageBuffer = Buffer.from(await res.arrayBuffer());

      // Get Gemini API Key
      let geminiApiKey: string | null = null;
      const geminiKeyRecord = await this.providerKeyRepo.findByProviderName('gemini');
      if (geminiKeyRecord && geminiKeyRecord.apiKeyEncrypted) {
        try {
          geminiApiKey = this.encryptionService.decrypt(geminiKeyRecord.apiKeyEncrypted);
        } catch (e) {
          console.error('Failed to decrypt Gemini key:', e);
        }
      }
      if (!geminiApiKey) {
        geminiApiKey = process.env.GEMINI_API_KEY || null;
      }

      if (!geminiApiKey) {
        await message.reply('⚠️ ยังไม่ได้ตั้งค่า Google Gemini API Key ในระบบ Dashboard ค่ะ');
        return;
      }

      // Scan with Vision AI
      const receiptData: ParsedReceiptData = await this.visionScanner.scanReceipt(geminiApiKey, imageBuffer);

      // Upload to Google Drive
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeMerchant = receiptData.merchantName.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
      const fileName = `Bill_${receiptData.billDate}_${safeMerchant}_${receiptData.totalAmount}THB_${timestamp}.jpg`;

      let driveLink = '';
      let driveFileId = '';
      try {
        const uploadResult = await this.storageService.uploadFile(
          fileName,
          'image/jpeg',
          imageBuffer,
          'Receipts'
        );
        driveLink = uploadResult.webViewLink;
        driveFileId = uploadResult.fileId;
      } catch (err) {
        console.error('Failed to upload to Google Drive:', err);
      }

      // Save to Database
      const billDate = receiptData.billDate ? new Date(receiptData.billDate) : new Date();
      await (this.prisma as any).receiptBill.create({
        data: {
          platform: 'discord',
          userId: message.author.id,
          merchantName: receiptData.merchantName,
          totalAmount: receiptData.totalAmount,
          currency: receiptData.currency || 'THB',
          billDate: isNaN(billDate.getTime()) ? new Date() : billDate,
          category: receiptData.category || 'ทั่วไป',
          summaryText: receiptData.summaryText,
          itemsJson: JSON.stringify(receiptData.items || []),
          googleDriveFileId: driveFileId || null,
          googleDriveViewUrl: driveLink || null,
        },
      });

      // Append receipt context to conversation history
      await this.conversationHistoryRepo.appendMessage(
        'discord',
        message.author.id,
        'assistant',
        `[บันทึกใบเสร็จ: ${receiptData.merchantName} ยอด ${receiptData.totalAmount} บาท หมวดหมู่ ${receiptData.category}]`
      );

      // Build Discord Embed
      const embed = new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle('🧾 บันทึกบิลใบเสร็จเรียบร้อยค่ะ!')
        .setDescription(receiptData.summaryText || 'สแกนและบันทึกข้อมูลเข้าสู่ระบบเรียบร้อยแล้วค่ะ')
        .addFields(
          { name: '🏪 ร้านค้า', value: receiptData.merchantName || 'ไม่ระบุ', inline: true },
          {
            name: '💰 ยอดสุทธิ',
            value: `฿${receiptData.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
            inline: true,
          },
          { name: '🏷️ หมวดหมู่', value: receiptData.category || 'ทั่วไป', inline: true },
          { name: '📅 วันที่บิล', value: receiptData.billDate || 'วันนี้', inline: true },
          {
            name: '☁️ Google Drive (5TB)',
            value: driveLink ? `[เปิดดูรูปใบเสร็จ](${driveLink})` : 'กำลังซิงค์เข้าคลาวด์',
            inline: true,
          }
        )
        .setFooter({ text: 'AI Personal Secretary • Google Drive & Neon PostgreSQL' })
        .setTimestamp();

      const components: any[] = [];
      if (driveLink) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('📂 เปิดดูรูปใน Drive').setURL(driveLink)
        );
        components.push(row);
      }

      await message.reply({ embeds: [embed], components });
    } catch (err: any) {
      console.error('Error handling Discord receipt image:', err);
      await message.reply(`⚠️ ขออภัยค่ะคุณท่าน เลขาไม่สามารถวิเคราะห์บิลนี้ได้: ${err.message || 'ภาพไม่ชัดเจน'}`);
    }
  }

  private async processAIChat(message: Message, userId: string, text: string): Promise<void> {
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const activePrompt = await this.systemPromptRepo.findActive();
      const systemPromptContent = activePrompt?.content || '';

      const history = await this.conversationHistoryRepo.getRecentHistory('discord', userId, 20);
      await this.conversationHistoryRepo.appendMessage('discord', userId, 'user', text);

      // Fetch recent receipt context
      let receiptsContext = '';
      try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const bills: any[] = await (this.prisma as any).receiptBill.findMany({
          where: { platform: 'discord', userId, createdAt: { gte: startOfMonth } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        if (bills.length > 0) {
          const totalMonth = bills.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
          receiptsContext =
            `\n\n[ข้อมูลบิลใบเสร็จที่บันทึกไว้ในระบบ Google Drive / Database ประจำเดือนนี้: ทั้งหมด ${bills.length} รายการ รวม ${totalMonth} บาท:\n` +
            bills
              .map(
                (b: any) =>
                  `- วันที่ ${b.billDate ? new Date(b.billDate).toISOString().split('T')[0] : 'วันนี้'}: ${b.merchantName} ยอด ${b.totalAmount} ${b.currency} (หมวด ${b.category || 'ทั่วไป'}) [ดูรูปใน Drive: ${b.googleDriveViewUrl || 'มี'}]`
              )
              .join('\n') +
            `\nคำสั่งสำคัญ: เมื่อเจ้านายถามยอดใช้จ่าย สรุปค่าใช้จ่าย หรือขอดูบิลใบเสร็จ ให้ตอบโดยนำข้อมูลบิลเหล่านี้มารวมและอ้างอิงตอบเจ้านายได้อย่างถูกต้องเสมอ!]`;
        }
      } catch (e) {
        console.warn('Could not fetch receipts for prompt context:', e);
      }

      const completion = await this.routeLLMQueryUseCase.execute({
        platform: 'discord',
        userId,
        messages: [...history, { role: 'user', content: text }],
        systemPrompt: systemPromptContent + receiptsContext,
      });

      await this.conversationHistoryRepo.appendMessage('discord', userId, 'assistant', completion.content);

      // Discord message length limit is 2,000 characters
      if (completion.content.length <= 2000) {
        await message.reply(completion.content);
      } else {
        // Split long messages
        const chunks = this.splitText(completion.content, 1950);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      }
    } catch (err: any) {
      console.error('Discord AI chat failed:', err);
      await message.reply('⚠️ ขออภัยค่ะ ขณะนี้ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ');
    }
  }

  private async sendSummaryEmbed(message: Message, userId: string): Promise<void> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
      ];
      const monthYearText = `${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

      const bills: any[] = await (this.prisma as any).receiptBill.findMany({
        where: {
          platform: 'discord',
          userId,
          createdAt: { gte: startOfMonth },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get drive folder link
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
        const embed = new EmbedBuilder()
          .setColor(0x0d9488)
          .setTitle(`📊 สรุปยอดค่าใช้จ่ายประจำเดือน ${monthYearText}`)
          .setDescription('ยังไม่มีการบันทึกบิลใบเสร็จในเดือนนี้ค่ะ')
          .addFields({
            name: '📸 วิธีบันทึกบิล',
            value: 'สามารถแนบรูปภาพใบเสร็จส่งเข้ามาในแชทนี้ได้ทันที ระบบจะสแกนและบันทึกเข้า Google Drive ให้โดยอัตโนมัติค่ะ',
          })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('📂 เปิดดูโฟลเดอร์ Google Drive').setURL(driveUrl)
        );

        await message.reply({ embeds: [embed], components: [row] });
        return;
      }

      const totalAmount = bills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
      const totalFormatted = totalAmount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Group by category
      const categoryMap = new Map<string, number>();
      for (const bill of bills) {
        const cat = bill.category || 'ทั่วไป';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (bill.totalAmount || 0));
      }

      let categoryList = '';
      categoryMap.forEach((catTotal, catName) => {
        categoryList += `• **${catName}**: ฿${catTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}\n`;
      });

      let latestList = '';
      bills.slice(0, 3).forEach((b: any) => {
        const dateStr = b.billDate
          ? new Date(b.billDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
          : new Date(b.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        latestList += `• **${b.merchantName || 'ร้านค้า'}** (${dateStr}): ฿${(b.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x0d9488)
        .setTitle(`📊 สรุปยอดค่าใช้จ่ายประจำเดือน ${monthYearText}`)
        .setDescription(`ยอดใช้จ่ายสะสมรวม: **฿${totalFormatted}** (ทั้งหมด ${bills.length} รายการ)`)
        .addFields(
          { name: '🏷️ แยกตามหมวดหมู่', value: categoryList || 'ไม่มีข้อมูล', inline: false },
          { name: '🕒 รายการบิลล่าสุด', value: latestList || 'ไม่มีข้อมูล', inline: false }
        )
        .setFooter({ text: 'ซิงค์รูปภาพต้นฉบับใน Google Drive โฟลเดอร์ Receipt_Bills เรียบร้อยค่ะ' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('📂 ดูรูปใบเสร็จทั้งหมดใน Drive').setURL(driveUrl)
      );

      await message.reply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      console.error('Error in sendSummaryEmbed:', err);
      await message.reply('⚠️ ขออภัยค่ะ เกิดข้อผิดพลาดในการดึงข้อมูลสรุปค่าใช้จ่าย');
    }
  }

  private async sendHelpEmbed(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('💡 คำสั่งและวิธีใช้งานคุณเลขา (AI Secretary)')
      .setDescription('เลขา AI ประจำตัว พร้อมช่วยตอบคำถาม สรุปงาน และบันทึกบัญชีรายรับ-รายจ่ายบิลใบเสร็จค่ะ')
      .addFields(
        {
          name: '💬 การพูดคุย',
          value: 'พิมพ์คุยใน DM หรือพิมพ์ `@คุณเลขา <ข้อความ>` ใน Server Channel ได้เลยค่ะ (ตอบสั้น กระชับ ตรงประเด็น)',
        },
        {
          name: '🧾 บันทึกบิลใบเสร็จ',
          value: 'แนบรูปภาพใบเสร็จส่งเข้ามาในแชท AI จะสแกนยอดเงินและบันทึกลง Google Drive ให้โดยอัตโนมัติค่ะ',
        },
        {
          name: '📊 ดูสรุปยอดเงิน',
          value: 'พิมพ์ `/summary` หรือ `สรุปค่าใช้จ่าย` เพื่อดูมินิแดชบอร์ดสรุปยอดประจำเดือน',
        },
        {
          name: '🤖 จัดการโมเดล AI',
          value: '• `/models`: ดูรายชื่อโมเดลทั้งหมด\n• `/model <ชื่อโมเดล>`: สลับโมเดล AI ที่ต้องการ\n• `/model reset`: คืนค่าเริ่มต้น',
        },
        {
          name: '🧹 ล้างบทสนทนา',
          value: 'พิมพ์ `/clear` เพื่อล้างความจำและเริ่มคุยเรื่องใหม่ได้อย่างสะอาดหมดจดค่ะ',
        }
      )
      .setFooter({ text: 'Powered by Global Model Priority Cascade & Vision OCR' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  private async sendModelsEmbed(message: Message, userId: string): Promise<void> {
    const activeKeys = await this.providerKeyRepo.findActiveOrdered();
    if (activeKeys.length === 0) {
      await message.reply('⚠️ ขณะนี้ยังไม่มีโมเดล AI ที่เปิดใช้งานในระบบค่ะ');
      return;
    }

    const pref = await this.userPreferenceRepo.findByUser('discord', userId);
    const currentPref = pref?.preferredModel;

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('🤖 รายชื่อโมเดล AI ที่พร้อมใช้งาน (Global Priority Cascade)')
      .setDescription(
        'ระบบจะเลือกใช้โมเดลตามลำดับ Priority หากโมเดลหลักติด Rate Limit จะสลับหาตัวสำรองให้อัตโนมัติค่ะ'
      );

    for (const key of activeKeys) {
      const models = await this.availableModelRepo.findByProviderId(key.id);
      if (models.length > 0) {
        const list = models
          .map((m) => {
            const isCurrent = currentPref === m.modelId ? ' **[คุณใช้อยู่ ✅]**' : '';
            return `• \`${m.modelId}\` — ${m.displayName}${isCurrent}`;
          })
          .join('\n');
        embed.addFields({ name: `🏢 ${key.displayName}`, value: list });
      }
    }

    embed.setFooter({ text: 'พิมพ์ /model <ชื่อโมเดล> เพื่อเปลี่ยนโมเดล หรือ /model reset เพื่อคืนค่าเดิม' });
    await message.reply({ embeds: [embed] });
  }

  private async handleModelSwitch(message: Message, userId: string, arg: string): Promise<void> {
    if (!arg || arg.toLowerCase() === 'reset') {
      await this.userPreferenceRepo.setPreferredModel('discord', userId, null);
      await message.reply('🔄 รีเซ็ตการตั้งค่าโมเดลกลับสู่ค่าเริ่มต้นของระบบ (Auto-Router Priority) เรียบร้อยค่ะ');
      return;
    }

    const targetModel = await this.availableModelRepo.findByModelId(arg);
    if (!targetModel) {
      await message.reply(`❌ ไม่พบโมเดล \`${arg}\` กรุณาพิมพ์ \`/models\` เพื่อดูรายชื่อโมเดลที่ถูกต้องนะคะ`);
      return;
    }

    await this.userPreferenceRepo.setPreferredModel('discord', userId, targetModel.modelId);
    await message.reply(`✅ เปลี่ยนโมเดลเป็น **${targetModel.displayName}** (\`${targetModel.modelId}\`) เรียบร้อยค่ะ`);
  }

  private splitText(text: string, maxChunkSize = 1950): string[] {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChunkSize) {
        chunks.push(remaining);
        break;
      }
      let splitIdx = remaining.lastIndexOf('\n', maxChunkSize);
      if (splitIdx <= 0) splitIdx = remaining.lastIndexOf(' ', maxChunkSize);
      if (splitIdx <= 0) splitIdx = maxChunkSize;
      chunks.push(remaining.slice(0, splitIdx).trim());
      remaining = remaining.slice(splitIdx).trim();
    }
    return chunks;
  }
}
