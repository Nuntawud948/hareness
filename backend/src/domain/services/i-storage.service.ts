export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  downloadUrl?: string;
  sizeBytes?: number;
}

export interface IStorageService {
  uploadFile(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    folderName?: string
  ): Promise<UploadResult>;
  isConfigured(): boolean;
}
