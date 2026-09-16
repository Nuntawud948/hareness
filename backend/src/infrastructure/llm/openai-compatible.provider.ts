import OpenAI from 'openai';
import {
  ILLMProvider,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../../domain/services/i-llm-provider.js';

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly providerName = 'openai_compatible';

  async generateResponse(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const startTime = Date.now();
    const client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl || 'https://api.deepseek.com/v1',
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of options.messages) {
      if (m.role === 'system') continue;
      messages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      });
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Hello' });
    }

    const modelName = options.modelId || 'deepseek-chat';

    const response = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    const responseTimeMs = Date.now() - startTime;
    const choice = response.choices[0];
    const content = choice?.message?.content || '';

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

    return {
      content,
      modelId: modelName,
      providerName: this.providerName,
      promptTokens,
      completionTokens,
      totalTokens,
      responseTimeMs,
    };
  }

  async healthCheck(apiKey: string, baseUrl?: string | null): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || 'https://api.deepseek.com/v1',
      });
      await client.models.list();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'OpenAI-compatible health check failed' };
    }
  }
}
