import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ILLMProvider,
  LLMGenerateOptions,
  LLMGenerateResult,
} from '../../domain/services/i-llm-provider.js';

export class GeminiProvider implements ILLMProvider {
  readonly providerName = 'gemini';

  async generateResponse(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(options.apiKey);

    const modelName = options.modelId || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: options.systemPrompt || undefined,
    });

    // Build chat contents from messages
    // Note: Gemini roles are 'user' or 'model' (for assistant)
    const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    for (const msg of options.messages) {
      if (msg.role === 'system') continue; // Handled by systemInstruction
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    });

    const responseText = response.response.text();
    const responseTimeMs = Date.now() - startTime;

    const usageMetadata = response.response.usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(contents.reduce((acc, c) => acc + c.parts[0].text.length, 0) / 4);
    const completionTokens = usageMetadata?.candidatesTokenCount || Math.ceil(responseText.length / 4);

    return {
      content: responseText,
      modelId: modelName,
      providerName: this.providerName,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      responseTimeMs,
    };
  }

  async healthCheck(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('ping');
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Gemini health check failed' };
    }
  }
}
