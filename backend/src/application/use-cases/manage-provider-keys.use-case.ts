import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error.js';
import { IAvailableModelRepository } from '../../domain/repositories/i-available-model.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILLMProvider } from '../../domain/services/i-llm-provider.js';

export interface ProviderKeyItemDto {
  id: string;
  providerName: string;
  displayName: string;
  maskedApiKey: string;
  hasApiKey: boolean;
  baseUrl?: string | null;
  isActive: boolean;
  priorityOrder: number;
  models: Array<{
    id: string;
    modelId: string;
    displayName: string;
    isDefault: boolean;
    maxTokens?: number | null;
  }>;
}

export class ManageProviderKeysUseCase {
  constructor(
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly availableModelRepo: IAvailableModelRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly providers: Map<string, ILLMProvider>
  ) {}

  async getAll(): Promise<ProviderKeyItemDto[]> {
    const keys = await this.providerKeyRepo.findAll();
    const result: ProviderKeyItemDto[] = [];

    for (const key of keys) {
      const models = await this.availableModelRepo.findByProviderId(key.id);
      let maskedKey = '';
      const hasApiKey = Boolean(key.apiKeyEncrypted && key.apiKeyEncrypted.trim().length > 0);

      if (hasApiKey) {
        try {
          const decrypted = this.encryptionService.decrypt(key.apiKeyEncrypted);
          maskedKey = this.encryptionService.mask(decrypted);
        } catch {
          maskedKey = 'sk-***[Decryption Error]';
        }
      }

      result.push({
        id: key.id,
        providerName: key.providerName,
        displayName: key.displayName,
        maskedApiKey: maskedKey,
        hasApiKey,
        baseUrl: key.baseUrl,
        isActive: key.isActive,
        priorityOrder: key.priorityOrder,
        models: models.map((m) => ({
          id: m.id,
          modelId: m.modelId,
          displayName: m.displayName,
          isDefault: m.isDefault,
          maxTokens: m.maxTokens,
        })),
      });
    }

    return result.sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  async updateKey(
    id: string,
    data: {
      rawApiKey?: string;
      displayName?: string;
      baseUrl?: string | null;
      isActive?: boolean;
      priorityOrder?: number;
    }
  ): Promise<void> {
    const existing = await this.providerKeyRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('ProviderKey', id);
    }

    let apiKeyEncrypted: string | undefined = undefined;
    if (data.rawApiKey && data.rawApiKey.trim().length > 0) {
      apiKeyEncrypted = this.encryptionService.encrypt(data.rawApiKey.trim());
    }

    await this.providerKeyRepo.update(id, {
      displayName: data.displayName,
      apiKeyEncrypted,
      baseUrl: data.baseUrl,
      isActive: data.isActive,
      priorityOrder: data.priorityOrder,
    });
  }

  async createKey(data: {
    providerName: string;
    displayName: string;
    rawApiKey?: string;
    baseUrl?: string | null;
    isActive?: boolean;
    priorityOrder?: number;
    initialModelId?: string;
    initialModelName?: string;
  }): Promise<string> {
    let apiKeyEncrypted = '';
    if (data.rawApiKey && data.rawApiKey.trim().length > 0) {
      apiKeyEncrypted = this.encryptionService.encrypt(data.rawApiKey.trim());
    }

    const created = await this.providerKeyRepo.create({
      providerName: data.providerName.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      apiKeyEncrypted,
      baseUrl: data.baseUrl?.trim() || null,
      isActive: data.isActive ?? true,
      priorityOrder: data.priorityOrder ?? 99,
    });

    if (data.initialModelId && data.initialModelName) {
      await this.availableModelRepo.create({
        providerId: created.id,
        modelId: data.initialModelId.trim(),
        displayName: data.initialModelName.trim(),
        isDefault: true,
      });
    }

    return created.id;
  }

  async deleteKey(id: string): Promise<void> {
    const existing = await this.providerKeyRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('ProviderKey', id);
    }
    await this.providerKeyRepo.delete(id);
  }

  async addModel(providerId: string, modelId: string, displayName: string, isDefault = false): Promise<void> {
    const provider = await this.providerKeyRepo.findById(providerId);
    if (!provider) {
      throw new EntityNotFoundError('ProviderKey', providerId);
    }

    await this.availableModelRepo.create({
      providerId,
      modelId: modelId.trim(),
      displayName: displayName.trim(),
      isDefault,
    });
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.availableModelRepo.delete(modelId);
  }

  async setDefaultModel(providerId: string, modelId: string): Promise<void> {
    await this.availableModelRepo.setDefaultModel(providerId, modelId);
  }

  async testConnection(providerId: string): Promise<{ ok: boolean; error?: string }> {
    const providerKey = await this.providerKeyRepo.findById(providerId);
    if (!providerKey) {
      throw new EntityNotFoundError('ProviderKey', providerId);
    }

    if (!providerKey.apiKeyEncrypted) {
      return { ok: false, error: 'No API key configured for this provider.' };
    }

    // Lookup adapter or fallback to generic openai_compatible for any custom/Chinese provider
    const adapter =
      this.providers.get(providerKey.providerName) || this.providers.get('openai_compatible');

    if (!adapter) {
      return { ok: false, error: `No implementation adapter found for provider: ${providerKey.providerName}` };
    }

    let apiKey = '';
    try {
      apiKey = this.encryptionService.decrypt(providerKey.apiKeyEncrypted);
    } catch (err: any) {
      return { ok: false, error: `Failed to decrypt key: ${err.message}` };
    }

    return await adapter.healthCheck(apiKey, providerKey.baseUrl);
  }
}
