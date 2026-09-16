import { google } from 'googleapis';
import { Readable } from 'stream';
import { IStorageService, UploadResult } from '../../domain/services/i-storage.service.js';

export class GoogleDriveStorageService implements IStorageService {
  private driveClient: any = null;
  private readonly targetFolderId: string | undefined;

  constructor() {
    this.targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.initClient();
  }

  private initClient(): void {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    try {
      if (serviceAccountJson) {
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
      console.warn('⚠️ GoogleDriveStorageService: Could not initialize Google Drive credentials.', err);
      this.driveClient = null;
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
    if (!this.isConfigured()) {
      // Graceful fallback for local development without credentials
      return {
        fileId: `local-mock-${Date.now()}`,
        fileName,
        webViewLink: `https://drive.google.com/file/d/mock-${encodeURIComponent(fileName)}/view`,
        sizeBytes: buffer.length,
      };
    }

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const parents: string[] = [];
    if (this.targetFolderId) {
      parents.push(this.targetFolderId);
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
