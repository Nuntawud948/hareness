import { PrismaClient } from '@prisma/client';
import { ProviderKey } from '../../domain/entities/provider-key.entity.js';
import {
  CreateProviderKeyDto,
  IProviderKeyRepository,
  UpdateProviderKeyDto,
} from '../../domain/repositories/i-provider-key.repository.js';

export class PrismaProviderKeyRepository implements IProviderKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<ProviderKey[]> {
    const records = await this.prisma.providerKey.findMany({
      include: { models: true },
      orderBy: { priorityOrder: 'asc' },
    });
    return records as ProviderKey[];
  }

  async findActiveOrdered(): Promise<ProviderKey[]> {
    const records = await this.prisma.providerKey.findMany({
      where: { isActive: true },
      include: { models: true },
      orderBy: { priorityOrder: 'asc' },
    });
    return records as ProviderKey[];
  }

  async findById(id: string): Promise<ProviderKey | null> {
    const record = await this.prisma.providerKey.findUnique({
      where: { id },
      include: { models: true },
    });
    return (record as ProviderKey) || null;
  }

  async findByProviderName(providerName: string): Promise<ProviderKey | null> {
    const record = await this.prisma.providerKey.findFirst({
      where: { providerName },
      include: { models: true },
    });
    return (record as ProviderKey) || null;
  }

  async create(data: CreateProviderKeyDto): Promise<ProviderKey> {
    const record = await this.prisma.providerKey.create({
      data: {
        providerName: data.providerName,
        displayName: data.displayName,
        apiKeyEncrypted: data.apiKeyEncrypted,
        baseUrl: data.baseUrl || null,
        isActive: data.isActive ?? true,
        priorityOrder: data.priorityOrder ?? 0,
      },
      include: { models: true },
    });
    return record as ProviderKey;
  }

  async update(id: string, data: UpdateProviderKeyDto): Promise<ProviderKey> {
    const record = await this.prisma.providerKey.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.apiKeyEncrypted !== undefined && { apiKeyEncrypted: data.apiKeyEncrypted }),
        ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priorityOrder !== undefined && { priorityOrder: data.priorityOrder }),
      },
      include: { models: true },
    });
    return record as ProviderKey;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.providerKey.delete({
      where: { id },
    });
  }

  async updatePriorityOrders(orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.providerKey.update({
          where: { id },
          data: { priorityOrder: index + 1 },
        })
      )
    );
  }
}
