import { AvailableModel } from '../entities/available-model.entity.js';

export interface CreateAvailableModelDto {
  providerId: string;
  modelId: string;
  displayName: string;
  isDefault?: boolean;
  isActive?: boolean;
  priorityOrder?: number;
  maxTokens?: number | null;
}

export interface UpdateAvailableModelDto {
  displayName?: string;
  isDefault?: boolean;
  isActive?: boolean;
  priorityOrder?: number;
  maxTokens?: number | null;
}

export interface AvailableModelWithProvider extends AvailableModel {
  providerName: string;
  providerDisplayName: string;
  providerIsActive: boolean;
}

export interface IAvailableModelRepository {
  findByProviderId(providerId: string): Promise<AvailableModel[]>;
  findByModelId(modelId: string): Promise<AvailableModel | null>;
  findAllOrdered(): Promise<AvailableModelWithProvider[]>;
  findAllActiveOrdered(): Promise<AvailableModelWithProvider[]>;
  create(data: CreateAvailableModelDto): Promise<AvailableModel>;
  update(id: string, data: UpdateAvailableModelDto): Promise<AvailableModel>;
  delete(id: string): Promise<void>;
  setDefaultModel(providerId: string, modelId: string): Promise<void>;
  reorderModels(orderedIds: string[]): Promise<void>;
  toggleActive(id: string, isActive: boolean): Promise<AvailableModel>;
}
