export interface AvailableModel {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  isActive: boolean;
  priorityOrder: number;
  maxTokens?: number | null;
  createdAt: Date;
}
