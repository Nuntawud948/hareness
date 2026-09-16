import { AvailableModel } from './available-model.entity.js';

export interface ProviderKey {
  id: string;
  providerName: string; // 'gemini' | 'openai' | 'claude' | 'openai_compatible'
  displayName: string;
  apiKeyEncrypted: string;
  baseUrl?: string | null;
  isActive: boolean;
  priorityOrder: number;
  models?: AvailableModel[];
  createdAt: Date;
  updatedAt: Date;
}
