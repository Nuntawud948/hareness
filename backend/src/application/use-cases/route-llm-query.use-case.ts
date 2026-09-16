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
  // In-memory cooldown tracker: modelId -> timestamp (ms) until which model is skipped
  private static modelCooldownMap = new Map<string, number>();

  static setCooldown(modelId: string, durationSeconds: number = 60): void {
    const until = Date.now() + durationSeconds * 1000;
    this.modelCooldownMap.set(modelId, until);
    console.log(`⏳ Model '${modelId}' entered cooldown for ${durationSeconds}s (until ${new Date(until).toISOString()})`);
  }

  static isCoolingDown(modelId: string): boolean {
    const until = this.modelCooldownMap.get(modelId);
    if (!until) return false;
    if (Date.now() > until) {
      this.modelCooldownMap.delete(modelId);
      return false;
    }
    return true;
  }

  static getCooldowns(): Record<string, number> {
    const now = Date.now();
    const result: Record<string, number> = {};
    for (const [modelId, until] of this.modelCooldownMap.entries()) {
      if (until > now) {
        result[modelId] = Math.ceil((until - now) / 1000);
      } else {
        this.modelCooldownMap.delete(modelId);
      }
    }
    return result;
  }

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

    // 2. Fetch all active models across all active providers, sorted by priorityOrder ASC
    const allActiveModels = await this.availableModelRepo.findAllActiveOrdered();

    // If no individual active models configured, fallback to legacy provider candidates
    if (allActiveModels.length === 0) {
      return this.executeLegacyFallback(dto, requestedModelId);
    }

    // 3. Build candidate list based on Global Model Priority (1, 2, 3...)
    let candidateModels: any[] = [];

    // If user explicitly requested a model, put it first
    if (requestedModelId) {
      const explicitModel = allActiveModels.find((m) => m.modelId === requestedModelId);
      if (explicitModel) {
        candidateModels.push(explicitModel);
      }
    }

    // Append remaining active models sorted by priorityOrder ASC
    for (const m of allActiveModels) {
      if (candidateModels.some((c) => c.modelId === m.modelId)) continue;
      candidateModels.push(m);
    }

    // Filter out models currently in rate-limit cooldown (unless it was explicitly requested by user)
    const availableCandidates = candidateModels.filter((m, idx) => {
      if (idx === 0 && requestedModelId && m.modelId === requestedModelId) {
        return true; // Always allow user's explicit pick to be tested
      }
      return !RouteLLMQueryUseCase.isCoolingDown(m.modelId);
    });

    // If all candidates are in cooldown, fallback to trying all anyway
    const finalCandidates = availableCandidates.length > 0 ? availableCandidates : candidateModels;

    const failureLog: Record<string, string> = {};
    let wasFailover = false;
    const keyCache = new Map<string, { key: any; decryptedApiKey: string }>();

    // 4. Try candidates in exact priority order (1, 2, 3...)
    for (const targetModel of finalCandidates) {
      const modelIdToUse = targetModel.modelId;

      // Fetch or use cached provider key
      let providerInfo = keyCache.get(targetModel.providerId);
      if (!providerInfo) {
        const keyRecord = await this.providerKeyRepo.findById(targetModel.providerId);
        if (!keyRecord || !keyRecord.isActive) {
          failureLog[targetModel.displayName || modelIdToUse] = 'Provider key inactive or missing';
          wasFailover = true;
          continue;
        }

        let apiKey = '';
        try {
          apiKey = this.encryptionService.decrypt(keyRecord.apiKeyEncrypted);
        } catch (err: any) {
          failureLog[keyRecord.displayName] = `Decryption failed: ${err.message}`;
          wasFailover = true;
          continue;
        }

        providerInfo = { key: keyRecord, decryptedApiKey: apiKey };
        keyCache.set(targetModel.providerId, providerInfo);
      }

      const { key: currentKey, decryptedApiKey: apiKey } = providerInfo;
      const providerAdapter =
        this.providers.get(currentKey.providerName) || this.providers.get('openai_compatible');

      if (!providerAdapter) {
        failureLog[`${targetModel.displayName} (${currentKey.displayName})`] = `No adapter registered for ${currentKey.providerName}`;
        wasFailover = true;
        continue;
      }

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
          `Priority model '${targetModel.displayName}' [${modelIdToUse}] on '${currentKey.displayName}' failed: ${err.message}. Cascading to next priority model.`
        );

        // If rate limited (429) or quota exhausted, place into cooldown for 60 seconds
        const isRateLimit = err.status === 429 || (err.message && /429|quota|rate limit|balance/i.test(err.message));
        if (isRateLimit) {
          RouteLLMQueryUseCase.setCooldown(modelIdToUse, 60);
        }

        failureLog[`${targetModel.displayName || modelIdToUse} (${currentKey.displayName})`] = err.message || 'Error';
        wasFailover = true;
        // Continue to next priority model in list!
      }
    }

    throw new AllProvidersFailedError(failureLog);
  }

  private async executeLegacyFallback(dto: CompletionRequestDto, requestedModelId: string | null): Promise<CompletionResultDto> {
    const activeKeys = await this.providerKeyRepo.findActiveOrdered();
    if (activeKeys.length === 0) {
      throw new ProviderUnavailableError('any', 'No active LLM providers configured.');
    }
    throw new ProviderUnavailableError('any', 'No active models found in cascade.');
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
