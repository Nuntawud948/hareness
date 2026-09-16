import { PrismaClient } from '@prisma/client';
import { IStorageService } from '../../domain/services/i-storage.service.js';

export interface ArchiveResult {
  archivedAt: string;
  chatMessagesCount: number;
  usageLogsCount: number;
  receiptsCount: number;
  uploadedFiles: Array<{
    fileName: string;
    fileId: string;
    webViewLink: string;
  }>;
  retentionCutoff: string;
}

export class ArchiveMonthlyLogsUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storageService: IStorageService
  ) {}

  /**
   * Archives logs and records older than the specified retention days (default: 30 days)
   * into formatted JSON files, uploads them to Google Drive 5TB, and safely purges old data
   * to keep Neon DB lightweight and within the free tier.
   */
  async execute(retentionDays: number = 30): Promise<ArchiveResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const yearMonth = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    // 1. Fetch old conversation history
    const oldChats = await this.prisma.conversationHistory.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch old usage logs
    const oldLogs = await this.prisma.usageLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Fetch old receipts
    const oldReceipts = await this.prisma.receiptBill.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    const uploadedFiles: Array<{ fileName: string; fileId: string; webViewLink: string }> = [];

    // Archive Conversation History
    if (oldChats.length > 0) {
      const chatFileName = `archive-chat-history-${yearMonth}-${timestamp}.json`;
      const chatBuffer = Buffer.from(JSON.stringify(oldChats, null, 2), 'utf-8');
      const uploadRes = await this.storageService.uploadFile(
        chatFileName,
        'application/json',
        chatBuffer,
        'Archives'
      );
      uploadedFiles.push({
        fileName: chatFileName,
        fileId: uploadRes.fileId,
        webViewLink: uploadRes.webViewLink,
      });

      // Purge from database
      await this.prisma.conversationHistory.deleteMany({
        where: {
          id: { in: oldChats.map((c: { id: string }) => c.id) },
        },
      });
    }

    // Archive Usage Logs
    if (oldLogs.length > 0) {
      const logsFileName = `archive-usage-logs-${yearMonth}-${timestamp}.json`;
      const logsBuffer = Buffer.from(JSON.stringify(oldLogs, null, 2), 'utf-8');
      const uploadRes = await this.storageService.uploadFile(
        logsFileName,
        'application/json',
        logsBuffer,
        'Archives'
      );
      uploadedFiles.push({
        fileName: logsFileName,
        fileId: uploadRes.fileId,
        webViewLink: uploadRes.webViewLink,
      });

      // Purge from database
      await this.prisma.usageLog.deleteMany({
        where: {
          id: { in: oldLogs.map((l: { id: string }) => l.id) },
        },
      });
    }

    // Archive Receipts (Keep summary export on Drive)
    if (oldReceipts.length > 0) {
      const receiptsFileName = `archive-receipts-summary-${yearMonth}-${timestamp}.json`;
      const receiptsBuffer = Buffer.from(JSON.stringify(oldReceipts, null, 2), 'utf-8');
      const uploadRes = await this.storageService.uploadFile(
        receiptsFileName,
        'application/json',
        receiptsBuffer,
        'Archives'
      );
      uploadedFiles.push({
        fileName: receiptsFileName,
        fileId: uploadRes.fileId,
        webViewLink: uploadRes.webViewLink,
      });
    }

    return {
      archivedAt: new Date().toISOString(),
      chatMessagesCount: oldChats.length,
      usageLogsCount: oldLogs.length,
      receiptsCount: oldReceipts.length,
      uploadedFiles,
      retentionCutoff: cutoffDate.toISOString(),
    };
  }
}
