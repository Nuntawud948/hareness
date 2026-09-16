import { PrismaClient } from '@prisma/client';
import { AvailableModel } from '../../domain/entities/available-model.entity.js';
import {
  CreateAvailableModelDto,
  IAvailableModelRepository,
  UpdateAvailableModelDto,
} from '../../domain/repositories/i-available-model.repository.js';

export class PrismaAvailableModelRepository implements IAvailableModelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProviderId(providerId: string): Promise<AvailableModel[]> {
    const records = await this.prisma.availableModel.findMany({
      where: { providerId },
      orderBy: { isDefault: 'desc' },
    });
    return records as AvailableModel[];
  }

  async findByModelId(modelId: string): Promise<AvailableModel | null> {
    const record = await this.prisma.availableModel.findFirst({
      where: { modelId },
    });
    return (record as AvailableModel) || null;
  }

  async findAllOrdered(): Promise<any[]> {
    const records = await this.prisma.availableModel.findMany({
      include: {
        provider: true,
      },
      orderBy: [
        { priorityOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return records.map((r) => ({
      id: r.id,
      providerId: r.providerId,
      modelId: r.modelId,
      displayName: r.displayName,
      isDefault: r.isDefault,
      isActive: (r as any).isActive ?? true,
      priorityOrder: (r as any).priorityOrder ?? 0,
      maxTokens: r.maxTokens,
      createdAt: r.createdAt,
      providerName: r.provider.providerName,
      providerDisplayName: r.provider.displayName,
      providerIsActive: r.provider.isActive,
    }));
  }

  async findAllActiveOrdered(): Promise<any[]> {
    const records = await this.prisma.availableModel.findMany({
      where: {
        isActive: true,
        provider: {
          isActive: true,
        },
      },
      include: {
        provider: true,
      },
      orderBy: [
        { priorityOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return records.map((r) => ({
      id: r.id,
      providerId: r.providerId,
      modelId: r.modelId,
      displayName: r.displayName,
      isDefault: r.isDefault,
      isActive: true,
      priorityOrder: (r as any).priorityOrder ?? 0,
      maxTokens: r.maxTokens,
      createdAt: r.createdAt,
      providerName: r.provider.providerName,
      providerDisplayName: r.provider.displayName,
      providerIsActive: r.provider.isActive,
    }));
  }

  async create(data: CreateAvailableModelDto): Promise<AvailableModel> {
    if (data.isDefault) {
      await this.prisma.availableModel.updateMany({
        where: { providerId: data.providerId },
        data: { isDefault: false },
      });
    }

    const count = await this.prisma.availableModel.count();

    const record = await this.prisma.availableModel.create({
      data: {
        providerId: data.providerId,
        modelId: data.modelId,
        displayName: data.displayName,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        priorityOrder: data.priorityOrder ?? count + 1,
        maxTokens: data.maxTokens || null,
      },
    });
    return record as unknown as AvailableModel;
  }

  async update(id: string, data: UpdateAvailableModelDto): Promise<AvailableModel> {
    const record = await this.prisma.availableModel.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priorityOrder !== undefined && { priorityOrder: data.priorityOrder }),
        ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
      },
    });
    return record as unknown as AvailableModel;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.availableModel.delete({
      where: { id },
    });
  }

  async setDefaultModel(providerId: string, modelId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.availableModel.updateMany({
        where: { providerId },
        data: { isDefault: false },
      }),
      this.prisma.availableModel.updateMany({
        where: { providerId, modelId },
        data: { isDefault: true },
      }),
    ]);
  }

  async reorderModels(orderedIds: string[]): Promise<void> {
    const operations = orderedIds.map((id, index) =>
      this.prisma.availableModel.update({
        where: { id },
        data: { priorityOrder: index + 1 },
      })
    );
    await this.prisma.$transaction(operations);
  }

  async toggleActive(id: string, isActive: boolean): Promise<AvailableModel> {
    const record = await this.prisma.availableModel.update({
      where: { id },
      data: { isActive },
    });
    return record as unknown as AvailableModel;
  }
}
