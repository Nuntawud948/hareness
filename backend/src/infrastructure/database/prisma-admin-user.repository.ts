import { PrismaClient } from '@prisma/client';
import {
  AdminUserEntity,
  IAdminUserRepository,
} from '../../domain/repositories/i-admin-user.repository.js';

export class PrismaAdminUserRepository implements IAdminUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUsername(username: string): Promise<AdminUserEntity | null> {
    const record = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    return (record as AdminUserEntity) || null;
  }

  async findById(id: string): Promise<AdminUserEntity | null> {
    const record = await this.prisma.adminUser.findUnique({
      where: { id },
    });
    return (record as AdminUserEntity) || null;
  }
}
