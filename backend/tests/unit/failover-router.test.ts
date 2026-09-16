import { describe, expect, it, vi } from 'vitest';
import { RouteLLMQueryUseCase } from '../../src/application/use-cases/route-llm-query.use-case.js';
import { ILLMProvider } from '../../src/domain/services/i-llm-provider.js';

describe('RouteLLMQueryUseCase Failover Logic', () => {
  it('should automatically failover to secondary provider when primary fails', async () => {
    // Mock Provider 1 (Primary - will fail)
    const mockPrimaryProvider: ILLMProvider = {
      providerName: 'gemini',
      generateResponse: vi.fn().mockRejectedValue(new Error('429 Rate limit exceeded')),
      healthCheck: vi.fn().mockResolvedValue({ ok: true }),
    };

    // Mock Provider 2 (Backup - will succeed)
    const mockBackupProvider: ILLMProvider = {
      providerName: 'openai',
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Response from OpenAI Backup',
        modelId: 'gpt-4o-mini',
        providerName: 'openai',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        responseTimeMs: 350,
      }),
      healthCheck: vi.fn().mockResolvedValue({ ok: true }),
    };

    const providersMap = new Map<string, ILLMProvider>();
    providersMap.set('gemini', mockPrimaryProvider);
    providersMap.set('openai', mockBackupProvider);

    // Mock Repositories
    const mockProviderKeyRepo: any = {
      findActiveOrdered: vi.fn().mockResolvedValue([
        {
          id: 'key-1',
          providerName: 'gemini',
          displayName: 'Google Gemini (Primary)',
          apiKeyEncrypted: 'enc:primary',
          isActive: true,
          priorityOrder: 1,
        },
        {
          id: 'key-2',
          providerName: 'openai',
          displayName: 'OpenAI (Backup)',
          apiKeyEncrypted: 'enc:backup',
          isActive: true,
          priorityOrder: 2,
        },
      ]),
      findById: vi.fn((id) => {
        if (id === 'key-1') {
          return Promise.resolve({
            id: 'key-1',
            providerName: 'gemini',
            displayName: 'Google Gemini (Primary)',
            apiKeyEncrypted: 'enc:primary',
            isActive: true,
          });
        }
        return Promise.resolve({
          id: 'key-2',
          providerName: 'openai',
          displayName: 'OpenAI (Backup)',
          apiKeyEncrypted: 'enc:backup',
          isActive: true,
        });
      }),
    };

    const mockAvailableModelRepo: any = {
      findByModelId: vi.fn().mockResolvedValue(null),
      findByProviderId: vi.fn().mockResolvedValue([
        { modelId: 'gpt-4o-mini', isDefault: true },
      ]),
      findAllActiveOrdered: vi.fn().mockResolvedValue([
        {
          id: 'model-1',
          providerId: 'key-1',
          modelId: 'gemini-3.1-flash-lite',
          displayName: 'Gemini 3.1 Flash Lite',
          priorityOrder: 1,
          isActive: true,
        },
        {
          id: 'model-2',
          providerId: 'key-2',
          modelId: 'gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          priorityOrder: 2,
          isActive: true,
        },
      ]),
    };

    const mockUserPreferenceRepo: any = {
      findByUser: vi.fn().mockResolvedValue(null),
    };

    const mockUsageLogRepo: any = {
      create: vi.fn().mockResolvedValue({}),
    };

    const mockEncryptionService: any = {
      decrypt: vi.fn((cipher) => `decrypted-${cipher}`),
    };

    const router = new RouteLLMQueryUseCase(
      mockProviderKeyRepo,
      mockAvailableModelRepo,
      mockUserPreferenceRepo,
      mockUsageLogRepo,
      mockEncryptionService,
      providersMap
    );

    const result = await router.execute({
      platform: 'line',
      userId: 'user-001',
      messages: [{ role: 'user', content: 'Hello AI' }],
    });

    expect(result.content).toBe('Response from OpenAI Backup');
    expect(result.wasFailover).toBe(true);
    expect(mockPrimaryProvider.generateResponse).toHaveBeenCalled();
    expect(mockBackupProvider.generateResponse).toHaveBeenCalled();
  });
});
