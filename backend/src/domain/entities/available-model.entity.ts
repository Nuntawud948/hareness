export interface AvailableModel {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  maxTokens?: number | null;
  createdAt: Date;
}
