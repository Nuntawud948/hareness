import { SystemPrompt } from '../entities/system-prompt.entity.js';

export interface CreateSystemPromptDto {
  name: string;
  content: string;
  isActive?: boolean;
}

export interface UpdateSystemPromptDto {
  name?: string;
  content?: string;
  isActive?: boolean;
}

export interface ISystemPromptRepository {
  findAll(): Promise<SystemPrompt[]>;
  findById(id: string): Promise<SystemPrompt | null>;
  findActive(): Promise<SystemPrompt | null>;
  create(data: CreateSystemPromptDto): Promise<SystemPrompt>;
  update(id: string, data: UpdateSystemPromptDto): Promise<SystemPrompt>;
  delete(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
}
