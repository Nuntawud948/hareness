import { ProviderKey } from '../entities/provider-key.entity.js';

export interface CreateProviderKeyDto {
  providerName: string;
  displayName: string;
  apiKeyEncrypted: string;
  baseUrl?: string | null;
  isActive?: boolean;
  priorityOrder?: number;
}

export interface UpdateProviderKeyDto {
  displayName?: string;
  apiKeyEncrypted?: string;
  baseUrl?: string | null;
  isActive?: boolean;
  priorityOrder?: number;
}

export interface IProviderKeyRepository {
  findAll(): Promise<ProviderKey[]>;
  findActiveOrdered(): Promise<ProviderKey[]>;
  findById(id: string): Promise<ProviderKey | null>;
  findByProviderName(providerName: string): Promise<ProviderKey | null>;
  create(data: CreateProviderKeyDto): Promise<ProviderKey>;
  update(id: string, data: UpdateProviderKeyDto): Promise<ProviderKey>;
  delete(id: string): Promise<void>;
  updatePriorityOrders(orderedIds: string[]): Promise<void>;
}
