import { prisma } from '../lib/database';
import {
  User,
  UserWithProjects,
  CreateUserInput,
  UpdateUserInput,
  NotFoundError,
  DuplicateError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class UserRepository {
  async create(data: CreateUserInput): Promise<User> {
    try {
      return await prisma.user.create({
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = (error.meta?.['target'] as string[])?.join(', ') || 'field';
          throw new DuplicateError('User', field);
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { username },
    });
  }

  async findWithProjects(id: string): Promise<UserWithProjects | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        projects: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('User', id);
        }
        if (error.code === 'P2002') {
          const field = (error.meta?.['target'] as string[])?.join(', ') || 'field';
          throw new DuplicateError('User', field);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<User> {
    try {
      return await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('User', id);
        }
      }
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { username },
    });
    return count > 0;
  }
}