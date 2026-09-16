import bcrypt from 'bcryptjs';
import { AuthenticationError } from '../../domain/errors/domain.error.js';
import { IAdminUserRepository } from '../../domain/repositories/i-admin-user.repository.js';

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginOutput {
  id: string;
  username: string;
}

export class AuthenticateAdminUseCase {
  constructor(private readonly adminUserRepo: IAdminUserRepository) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.adminUserRepo.findByUsername(input.username);
    if (!user) {
      throw new AuthenticationError('Invalid username or password.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid username or password.');
    }

    return {
      id: user.id,
      username: user.username,
    };
  }
}
