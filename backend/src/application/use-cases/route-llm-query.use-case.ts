import { BotPlatform } from '../../domain/entities/bot-channel.entity.js';
import { ChatMessage } from '../../domain/entities/chat-message.entity.js';
import { AllProvidersFailedError, ProviderUnavailableError } from '../../domain/errors/domain.error.js';
import { IAvailableModelRepository } from '../../domain/repositories/i-available-model.repository.js';
import { IProviderKeyRepository } from '../../domain/repositories/i-provider-key.repository.js';
import { IUsageLogRepository } from '../../domain/repositories/i-usage-log.repository.js';
import { IUserPreferenceRepository } from '../../domain/repositories/i-user-preference.repository.js';
import { IEncryptionService } from '../../domain/services/i-encryption.service.js';
import { ILLMProvider } from '../../domain/services/i-llm-provider.js';

export interface CompletionRequestDto {
  platform: BotPlatform;
  userId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  preferredModelOverride?: string | null;
}

export interface CompletionResultDto {
  content: string;
  providerName: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  responseTimeMs: number;
  wasFailover: boolean;
  failoverReason?: string;
}

export class RouteLLMQueryUseCase {
  constructor(
    private readonly providerKeyRepo: IProviderKeyRepository,
    private readonly availableModelRepo: IAvailableModelRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly usageLogRepo: IUsageLogRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly providers: Map<string, ILLMProvider>
  ) {}

  async execute(dto: CompletionRequestDto): Promise<CompletionResultDto> {
    // 1. Check user preferred model
    let requestedModelId = dto.preferredModelOverride;
    if (!requestedModelId) {
      const pref = await this.userPreferenceRepo.findByUser(dto.platform, dto.userId);
      requestedModelId = pref?.preferredModel || null;
    }

    // 2. Fetch all active providers ordered by priority
    const activeKeys = await this.providerKeyRepo.findActiveOrdered();
    if (activeKeys.length === 0) {
      throw new ProviderUnavailableError('any', 'No active LLM providers configured.');
    }

    // 3. Build candidate list: prioritize provider with requested model if available
    let candidates = [...activeKeys];

    if (requestedModelId) {
      const targetModel = await this.availableModelRepo.findByModelId(requestedModelId);
      if (targetModel) {
        const preferredKeyIndex = candidates.findIndex((k) => k.id === targetModel.providerId);
        if (preferredKeyIndex >= 0) {
          const [preferredKey] = candidates.splice(preferredKeyIndex, 1);
          candidates.unshift(preferredKey); // Put user's requested provider first
        }
      }
    }

    const failureLog: Record<string, string> = {};
    let wasFailover = false;

    // 4. Try candidates in order
    for (let i = 0; i < candidates.length; i++) {
      const currentKey = candidates[i];
      const providerAdapter =
        this.providers.get(currentKey.providerName) || this.providers.get('openai_compatible');

      if (!providerAdapter) {
        failureLog[currentKey.displayName] = `No adapter registered for ${currentKey.providerName}`;
        wasFailover = true;
        continue;
      }

      // Decrypt API key
      let apiKey = '';
      try {
        apiKey = this.encryptionService.decrypt(currentKey.apiKeyEncrypted);
      } catch (err: any) {
        failureLog[currentKey.displayName] = `Decryption failed: ${err.message}`;
        wasFailover = true;
        continue;
      }

      if (!apiKey) {
        failureLog[currentKey.displayName] = 'API key is empty';
        wasFailover = true;
        continue;
      }

      // Determine model candidates for this provider
      const providerModels = await this.availableModelRepo.findByProviderId(currentKey.id);
      let modelCandidates: string[] = [];

      if (i === 0 && requestedModelId && providerModels.some((m) => m.modelId === requestedModelId)) {
        modelCandidates = [
          requestedModelId,
          ...providerModels.filter((m) => m.modelId !== requestedModelId).map((m) => m.modelId),
        ];
      } else {
        const defaultModel = providerModels.find((m) => m.isDefault);
        const others = providerModels.filter((m) => !m.isDefault).map((m) => m.modelId);
        modelCandidates = defaultModel ? [defaultModel.modelId, ...others] : (others.length > 0 ? others : ['default']);
      }

      // Try each model candidate for this provider
      for (const modelIdToUse of modelCandidates) {
        try {
          const result = await providerAdapter.generateResponse({
            modelId: modelIdToUse,
            messages: dto.messages,
            systemPrompt: dto.systemPrompt,
            apiKey,
            baseUrl: currentKey.baseUrl,
          });

          const estimatedCostUsd = this.calculateCost(
            result.modelId,
            result.promptTokens,
            result.completionTokens
          );

          // Record usage asynchronously
          this.usageLogRepo
            .create({
              platform: dto.platform,
              userId: dto.userId,
              providerName: currentKey.providerName,
              modelId: result.modelId,
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              totalTokens: result.totalTokens,
              estimatedCostUsd,
              responseTimeMs: result.responseTimeMs,
              wasFailover,
            })
            .catch((err) => console.error('Failed to log usage:', err));

          return {
            content: result.content,
            providerName: currentKey.displayName,
            modelId: result.modelId,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
            estimatedCostUsd,
            responseTimeMs: result.responseTimeMs,
            wasFailover,
            failoverReason: wasFailover ? JSON.stringify(failureLog) : undefined,
          };
        } catch (err: any) {
          console.warn(
            `Model '${modelIdToUse}' on '${currentKey.displayName}' failed: ${err.message}. Cascading to next candidate.`
          );
          failureLog[`${currentKey.displayName} [${modelIdToUse}]`] = err.message || 'Error';
          wasFailover = true;
          // Try next model of same provider, or cascades to next provider
        }
      }
    }

    throw new AllProvidersFailedError(failureLog);
  }

  private calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    // Pricing per million tokens (input / output)
    const pricingMap: Record<string, [number, number]> = {
      'gemini-2.0-flash': [0.1, 0.4],
      'gemini-1.5-flash': [0.075, 0.3],
      'gemini-1.5-pro': [1.25, 5.0],
      'gpt-4o-mini': [0.15, 0.6],
      'gpt-4o': [2.5, 10.0],
      'o3-mini': [1.1, 4.4],
      'claude-3-5-haiku-latest': [0.8, 4.0],
      'claude-3-5-sonnet-latest': [3.0, 15.0],
      'deepseek-chat': [0.14, 0.28],
      'deepseek-reasoner': [0.55, 2.19],
    };

    const [inputPerM, outputPerM] = pricingMap[modelId] || [1.0, 3.0];
    const cost = (promptTokens / 1_000_000) * inputPerM + (completionTokens / 1_000_000) * outputPerM;
    return Number(cost.toFixed(6));
  }
}
