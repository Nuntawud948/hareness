import { ChatMessage } from '../entities/chat-message.entity.js';

export interface LLMGenerateOptions {
  modelId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  apiKey: string;
  baseUrl?: string | null;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMGenerateResult {
  content: string;
  modelId: string;
  providerName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
}

export interface ILLMProvider {
  readonly providerName: string;
  generateResponse(options: LLMGenerateOptions): Promise<LLMGenerateResult>;
  healthCheck(apiKey: string, baseUrl?: string | null): Promise<{ ok: boolean; error?: string }>;
}
