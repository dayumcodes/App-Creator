import { prisma } from '../lib/database';
import {
  PromptHistory,
  CreatePromptHistoryInput,
  NotFoundError,
  PaginationOptions,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class PromptHistoryRepository {
  async create(data: CreatePromptHistoryInput): Promise<PromptHistory> {
    return await prisma.promptHistory.create({
      data,
    });
  }

  async findById(id: string): Promise<PromptHistory | null> {
    return await prisma.promptHistory.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<PromptHistory> {
    const prompt = await this.findById(id);
    if (!prompt) {
      throw new NotFoundError('PromptHistory', id);
    }
    return prompt;
  }

  async findByProject(
    projectId: string,
    options: PaginationOptions = {}
  ): Promise<{
    prompts: PromptHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [prompts, total] = await Promise.all([
      prisma.promptHistory.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promptHistory.count({
        where: { projectId },
      }),
    ]);

    return {
      prompts,
      total,
      page,
      limit,
    };
  }

  async findLatestByProject(
    projectId: string,
    limit: number = 10
  ): Promise<PromptHistory[]> {
    return await prisma.promptHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async delete(id: string): Promise<PromptHistory> {
    try {
      return await prisma.promptHistory.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('PromptHistory', id);
        }
      }
      throw error;
    }
  }

  async deleteAllByProject(projectId: string): Promise<number> {
    const result = await prisma.promptHistory.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.promptHistory.count({
      where: { id },
    });
    return count > 0;
  }

  async getPromptCount(projectId: string): Promise<number> {
    return await prisma.promptHistory.count({
      where: { projectId },
    });
  }

  async searchPrompts(
    projectId: string,
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<{
    prompts: PromptHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PromptHistoryWhereInput = {
      projectId,
      OR: [
        { prompt: { contains: searchTerm, mode: 'insensitive' } },
        { response: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    const [prompts, total] = await Promise.all([
      prisma.promptHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promptHistory.count({ where }),
    ]);

    return {
      prompts,
      total,
      page,
      limit,
    };
  }
}