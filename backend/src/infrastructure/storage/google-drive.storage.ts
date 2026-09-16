import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { IStorageService, UploadResult } from '../../domain/services/i-storage.service.js';

export class GoogleDriveStorageService implements IStorageService {
  private driveClient: any = null;
  private targetFolderId: string | undefined;
  private prisma?: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma;
    this.targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.initClientFromEnv();
  }

  private initClientFromEnv(): void {
    const oauthClientId = process.env.GOOGLE_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oauthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    try {
      if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
        const oauth2Client = new google.auth.OAuth2(
          oauthClientId,
          oauthClientSecret
        );
        oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
        this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('✅ GoogleDriveStorageService: Initialized with OAuth2 from ENV (User 5TB Drive)');
      } else if (serviceAccountJson) {
        const credentials = JSON.parse(serviceAccountJson);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });
        this.driveClient = google.drive({ version: 'v3', auth });
      } else if (clientEmail && privateKey) {
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });
        this.driveClient = google.drive({ version: 'v3', auth });
      }
    } catch (err) {
      console.warn('⚠️ GoogleDriveStorageService: Could not initialize Google Drive from ENV.', err);
      this.driveClient = null;
    }
  }

  private async ensureClient(): Promise<boolean> {
    if (this.driveClient) return true;

    // Try loading from database StorageConfig
    if (this.prisma) {
      try {
        const config = await (this.prisma as any).storageConfig.findUnique({
          where: { id: 'google_drive' },
        });

        if (config && config.isActive && config.clientId && config.clientSecret && config.refreshToken) {
          const oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret
          );
          oauth2Client.setCredentials({ refresh_token: config.refreshToken });
          this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
          if (config.folderId) {
            this.targetFolderId = config.folderId;
          }
          console.log('✅ GoogleDriveStorageService: Initialized with OAuth2 from Neon DB StorageConfig (5TB Drive)');
          return true;
        }
      } catch (err) {
        console.warn('⚠️ GoogleDriveStorageService: Could not load StorageConfig from DB:', err);
      }
    }

    return this.driveClient !== null;
  }

  private async ensureTargetFolder(): Promise<string | undefined> {
    if (!this.driveClient) return undefined;

    // If targetFolderId is already set, verify it works
    if (this.targetFolderId) {
      try {
        await this.driveClient.files.get({
          fileId: this.targetFolderId,
          fields: 'id, name',
          supportsAllDrives: true,
        });
        return this.targetFolderId;
      } catch {
        console.warn(`⚠️ Target folder ID ${this.targetFolderId} not found, searching/creating "Receipt_Bills"...`);
      }
    }

    // Search for existing Receipt_Bills folder
    try {
      const searchRes = await this.driveClient.files.list({
        q: "name = 'Receipt_Bills' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name)',
      });

      if (searchRes.data.files && searchRes.data.files.length > 0) {
        this.targetFolderId = searchRes.data.files[0].id;
        return this.targetFolderId;
      }

      // Create new folder
      const createRes = await this.driveClient.files.create({
        requestBody: {
          name: 'Receipt_Bills',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
      });

      this.targetFolderId = createRes.data.id;
      console.log('✅ Auto-created "Receipt_Bills" folder in Drive:', this.targetFolderId);

      // Save back to DB if possible
      if (this.prisma && this.targetFolderId) {
        await (this.prisma as any).storageConfig.update({
          where: { id: 'google_drive' },
          data: { folderId: this.targetFolderId },
        }).catch(() => {});
      }

      return this.targetFolderId;
    } catch (err) {
      console.error('Failed to ensure target folder in Drive:', err);
      return undefined;
    }
  }

  isConfigured(): boolean {
    return this.driveClient !== null;
  }

  async uploadFile(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    subfolderName?: string
  ): Promise<UploadResult> {
    await this.ensureClient();

    if (!this.isConfigured()) {
      // Graceful fallback for local development without credentials
      console.warn('⚠️ GoogleDriveStorageService not configured; returning mock result.');
      return {
        fileId: `local-mock-${Date.now()}`,
        fileName,
        webViewLink: `https://drive.google.com/file/d/mock-${encodeURIComponent(fileName)}/view`,
        sizeBytes: buffer.length,
      };
    }

    const folderId = await this.ensureTargetFolder();

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const parents: string[] = [];
    if (folderId) {
      parents.push(folderId);
    }

    const fileMetadata: any = {
      name: fileName,
      parents: parents.length > 0 ? parents : undefined,
    };

    const media = {
      mimeType,
      body: stream,
    };

    const res = await this.driveClient.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink, size',
    });

    // Make file accessible via link if possible
    try {
      await this.driveClient.permissions.create({
        fileId: res.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch {
      // Ignore permission error if restricted by Google Workspace admin
    }

    return {
      fileId: res.data.id || '',
      fileName: res.data.name || fileName,
      webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
      downloadUrl: res.data.webContentLink,
      sizeBytes: res.data.size ? parseInt(res.data.size, 10) : buffer.length,
    };
  }
}
