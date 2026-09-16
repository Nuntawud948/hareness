import { PrismaClient } from '@prisma/client';
import { SystemPrompt } from '../../domain/entities/system-prompt.entity.js';
import {
  CreateSystemPromptDto,
  ISystemPromptRepository,
  UpdateSystemPromptDto,
} from '../../domain/repositories/i-system-prompt.repository.js';

export class PrismaSystemPromptRepository implements ISystemPromptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<SystemPrompt[]> {
    const records = await this.prisma.systemPrompt.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records as SystemPrompt[];
  }

  async findById(id: string): Promise<SystemPrompt | null> {
    const record = await this.prisma.systemPrompt.findUnique({
      where: { id },
    });
    return (record as SystemPrompt) || null;
  }

  async findActive(): Promise<SystemPrompt | null> {
    const record = await this.prisma.systemPrompt.findFirst({
      where: { isActive: true },
    });
    return (record as SystemPrompt) || null;
  }

  async create(data: CreateSystemPromptDto): Promise<SystemPrompt> {
    if (data.isActive) {
      await this.prisma.systemPrompt.updateMany({
        data: { isActive: false },
      });
    }

    const record = await this.prisma.systemPrompt.create({
      data: {
        name: data.name,
        content: data.content,
        isActive: data.isActive ?? false,
      },
    });
    return record as SystemPrompt;
  }

  async update(id: string, data: UpdateSystemPromptDto): Promise<SystemPrompt> {
    if (data.isActive) {
      await this.prisma.systemPrompt.updateMany({
        where: { id: { not: id } },
        data: { isActive: false },
      });
    }

    const record = await this.prisma.systemPrompt.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return record as SystemPrompt;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.systemPrompt.delete({
      where: { id },
    });
  }

  async setActive(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.systemPrompt.updateMany({
        data: { isActive: false },
      }),
      this.prisma.systemPrompt.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
  }
}
