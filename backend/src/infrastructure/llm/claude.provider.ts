import Anthropic from '@anthropic-ai/sdk';
import {
  ILLMProvider,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../../domain/services/i-llm-provider.js';

export class ClaudeProvider implements ILLMProvider {
  readonly providerName = 'claude';

  async generateResponse(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const startTime = Date.now();
    const client = new Anthropic({
      apiKey: options.apiKey,
    });

    const messages: Anthropic.MessageParam[] = [];

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

    const modelName = options.modelId || 'claude-3-5-haiku-latest';

    const response = await client.messages.create({
      model: modelName,
      messages,
      system: options.systemPrompt || undefined,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
    });

    const responseTimeMs = Date.now() - startTime;
    const firstBlock = response.content[0];
    const content = firstBlock && 'text' in firstBlock ? firstBlock.text : '';

    const promptTokens = response.usage?.input_tokens || 0;
    const completionTokens = response.usage?.output_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

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

  async healthCheck(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-3-5-haiku-latest',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Claude health check failed' };
    }
  }
}
