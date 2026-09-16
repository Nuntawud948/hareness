import { EntityNotFoundError } from '../../domain/errors/domain.error.js';
import { SystemPrompt } from '../../domain/entities/system-prompt.entity.js';
import { ISystemPromptRepository } from '../../domain/repositories/i-system-prompt.repository.js';

export class ManageSystemPromptUseCase {
  constructor(private readonly systemPromptRepo: ISystemPromptRepository) {}

  async getAll(): Promise<SystemPrompt[]> {
    return this.systemPromptRepo.findAll();
  }

  async getActive(): Promise<SystemPrompt | null> {
    return this.systemPromptRepo.findActive();
  }

  async create(name: string, content: string, isActive = false): Promise<SystemPrompt> {
    return this.systemPromptRepo.create({
      name: name.trim(),
      content: content.trim(),
      isActive,
    });
  }

  async update(id: string, name?: string, content?: string): Promise<SystemPrompt> {
    const existing = await this.systemPromptRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('SystemPrompt', id);
    }

    return this.systemPromptRepo.update(id, {
      name: name?.trim(),
      content: content?.trim(),
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.systemPromptRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('SystemPrompt', id);
    }
    await this.systemPromptRepo.delete(id);
  }

  async activate(id: string): Promise<void> {
    const existing = await this.systemPromptRepo.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('SystemPrompt', id);
    }
    await this.systemPromptRepo.setActive(id);
  }
}
