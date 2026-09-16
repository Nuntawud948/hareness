import { AvailableModel } from '../entities/available-model.entity.js';

export interface CreateAvailableModelDto {
  providerId: string;
  modelId: string;
  displayName: string;
  isDefault?: boolean;
  maxTokens?: number | null;
}

export interface UpdateAvailableModelDto {
  displayName?: string;
  isDefault?: boolean;
  maxTokens?: number | null;
}

export interface IAvailableModelRepository {
  findByProviderId(providerId: string): Promise<AvailableModel[]>;
  findByModelId(modelId: string): Promise<AvailableModel | null>;
  create(data: CreateAvailableModelDto): Promise<AvailableModel>;
  update(id: string, data: UpdateAvailableModelDto): Promise<AvailableModel>;
  delete(id: string): Promise<void>;
  setDefaultModel(providerId: string, modelId: string): Promise<void>;
}
