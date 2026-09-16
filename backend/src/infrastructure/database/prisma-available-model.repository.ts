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

  async create(data: CreateAvailableModelDto): Promise<AvailableModel> {
    if (data.isDefault) {
      await this.prisma.availableModel.updateMany({
        where: { providerId: data.providerId },
        data: { isDefault: false },
      });
    }

    const record = await this.prisma.availableModel.create({
      data: {
        providerId: data.providerId,
        modelId: data.modelId,
        displayName: data.displayName,
        isDefault: data.isDefault ?? false,
        maxTokens: data.maxTokens || null,
      },
    });
    return record as AvailableModel;
  }

  async update(id: string, data: UpdateAvailableModelDto): Promise<AvailableModel> {
    const record = await this.prisma.availableModel.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
      },
    });
    return record as AvailableModel;
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
}
