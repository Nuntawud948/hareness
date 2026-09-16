import { PrismaClient } from '@prisma/client';
import { IBotChannelRepository } from '../../domain/repositories/i-bot-channel.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILineMessagingGateway } from '../../domain/services/i-messaging-gateway.js';
import { IStorageService } from '../../domain/services/i-storage.service.js';
import { GeminiVisionReceiptScanner, ParsedReceiptData } from '../../infrastructure/llm/gemini-vision.service.js';

export interface ProcessReceiptImageInput {
  platform: 'line' | 'telegram';
  userId: string;
  messageId: string;
  replyToken: string;
}

export class ProcessReceiptImageUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly botChannelRepo: IBotChannelRepository,
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly lineGateway: ILineMessagingGateway,
    private readonly storageService: IStorageService,
    private readonly visionScanner: GeminiVisionReceiptScanner
  ) {}

  async execute(input: ProcessReceiptImageInput): Promise<void> {
    const { platform, userId, messageId, replyToken } = input;

    // 1. Get channel token
    const channel = await this.botChannelRepo.findByPlatform(platform);
    if (!channel || !channel.isActive || !channel.lineAccessToken) {
      console.warn('Channel not configured for receipt image processing');
      return;
    }

    const channelAccessToken = this.encryptionService.decrypt(channel.lineAccessToken);

    // 2. Download image buffer
    let imageBuffer: Buffer;
    try {
      imageBuffer = await this.lineGateway.getMessageContent(messageId, channelAccessToken);
    } catch (err) {
      console.error('Failed to download image from LINE:', err);
      await this.lineGateway.replyMessage(
        replyToken,
        '❌ ขออภัยค่ะคุณท่าน เลขาไม่สามารถดาวน์โหลดรูปภาพได้ กรุณาลองใหม่อีกครั้งนะคะ',
        channelAccessToken
      );
      return;
    }

    // 3. Find Gemini API Key
    let geminiApiKey: string | null = null;
    const geminiKeyRecord = await this.providerKeyRepo.findByProviderName('gemini');
    if (geminiKeyRecord && geminiKeyRecord.apiKeyEncrypted) {
      try {
        geminiApiKey = this.encryptionService.decrypt(geminiKeyRecord.apiKeyEncrypted);
      } catch (e) {
        console.error('Failed to decrypt Gemini API key:', e);
      }
    }

    // Fallback to process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      geminiApiKey = process.env.GEMINI_API_KEY || null;
    }

    if (!geminiApiKey) {
      await this.lineGateway.replyMessage(
        replyToken,
        '⚠️ คุณท่านยังไม่ได้ตั้งค่า API Key ของ Google Gemini ในเมนู Dashboard เลขาจึงยังไม่สามารถเปิดใช้ระบบ Vision OCR เพื่ออ่านบิลได้ค่ะ',
        channelAccessToken
      );
      return;
    }

    // 4. Scan receipt with Vision AI
    let receiptData: ParsedReceiptData;
    try {
      receiptData = await this.visionScanner.scanReceipt(geminiApiKey, imageBuffer);
    } catch (err: any) {
      console.error('Receipt OCR failed:', err);
      await this.lineGateway.replyMessage(
        replyToken,
        `⚠️ ขออภัยค่ะคุณท่าน เลขาไม่สามารถวิเคราะห์บิลนี้ได้: ${err.message || 'รูปแบบภาพไม่ชัดเจน'}`,
        channelAccessToken
      );
      return;
    }

    // 5. Upload to Google Drive (5TB storage)
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
      console.error('Failed to upload receipt to Google Drive:', err);
    }

    // 6. Save into PostgreSQL Database
    try {
      await (this.prisma as any).receiptBill.create({
        data: {
          platform,
          userId,
          merchantName: receiptData.merchantName,
          totalAmount: receiptData.totalAmount,
          currency: receiptData.currency,
          billDate: receiptData.billDate ? new Date(receiptData.billDate) : new Date(),
          category: receiptData.category,
          summaryText: receiptData.summaryText,
          itemsJson: JSON.stringify(receiptData.items),
          googleDriveFileId: driveFileId || null,
          googleDriveViewUrl: driveLink || null,
        },
      });
    } catch (dbErr) {
      console.error('Failed to save receipt bill to database:', dbErr);
    }

    // 7. Calculate this month's total spending
    let monthTotal = 0;
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const billsThisMonth: Array<{ totalAmount: number }> = await (this.prisma as any).receiptBill.findMany({
        where: {
          platform,
          userId,
          createdAt: { gte: startOfMonth },
        },
        select: { totalAmount: true },
      });
      monthTotal = billsThisMonth.reduce((sum: number, b: { totalAmount: number }) => sum + b.totalAmount, 0);
    } catch {
      monthTotal = receiptData.totalAmount;
    }

    // 8. Reply politely as AI Secretary
    const formattedAmount = receiptData.totalAmount.toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedMonthTotal = monthTotal.toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    let replyText = `🧾 บันทึกบิลเรียบร้อยค่ะคุณท่าน!\n\n` +
      `🏢 ร้านค้า: ${receiptData.merchantName}\n` +
      `💰 ยอดรวม: ${formattedAmount} ${receiptData.currency}\n` +
      `🏷️ หมวดหมู่: ${receiptData.category}\n` +
      `📅 วันที่: ${receiptData.billDate}\n\n` +
      `📊 ยอดใช้จ่ายสะสมเดือนนี้: ${formattedMonthTotal} บาท\n`;

    if (receiptData.items && receiptData.items.length > 0) {
      const itemsSummary = receiptData.items
        .slice(0, 5)
        .map((it) => `• ${it.name}${it.price ? ` (${it.price}บ.)` : ''}`)
        .join('\n');
      replyText += `\n📝 รายการสินค้า:\n${itemsSummary}\n`;
    }

    if (driveLink) {
      replyText += `\n📁 เก็บรูปใน Google Drive ให้แล้วค่ะ:\n${driveLink}`;
    }

    await this.lineGateway.replyMessage(replyToken, replyText, channelAccessToken);
  }
}
