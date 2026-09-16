export interface AdminUserEntity {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminUserRepository {
  findByUsername(username: string): Promise<AdminUserEntity | null>;
  findById(id: string): Promise<AdminUserEntity | null>;
}
