import { prisma } from '../lib/database';
import {
  FileChange,
  FileChangeWithDiff,
  CreateFileChangeInput,
  NotFoundError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class FileChangeRepository {
  async create(data: CreateFileChangeInput): Promise<FileChange> {
    return await prisma.fileChange.create({
      data,
    });
  }

  async findById(id: string): Promise<FileChange | null> {
    return await prisma.fileChange.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<FileChange> {
    const change = await this.findById(id);
    if (!change) {
      throw new NotFoundError('FileChange', id);
    }
    return change;
  }

  async findByProject(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<FileChange[]> {
    return await prisma.fileChange.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findByProjectAndFile(
    projectId: string,
    filename: string,
    limit?: number,
    offset?: number
  ): Promise<FileChange[]> {
    return await prisma.fileChange.findMany({
      where: { 
        projectId,
        filename,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findRecentChanges(
    projectId: string,
    hours: number = 24
  ): Promise<FileChange[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return await prisma.fileChange.findMany({
      where: { 
        projectId,
        createdAt: {
          gte: since,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string): Promise<FileChange> {
    try {
      return await prisma.fileChange.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('FileChange', id);
        }
      }
      throw error;
    }
  }

  async deleteAllByProject(projectId: string): Promise<number> {
    const result = await prisma.fileChange.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async getChangeCount(projectId: string): Promise<number> {
    return await prisma.fileChange.count({
      where: { projectId },
    });
  }

  async getFileChangeCount(projectId: string, filename: string): Promise<number> {
    return await prisma.fileChange.count({
      where: { 
        projectId,
        filename,
      },
    });
  }

  async createBatch(changes: CreateFileChangeInput[]): Promise<FileChange[]> {
    return await prisma.$transaction(
      changes.map(change => 
        prisma.fileChange.create({ data: change })
      )
    );
  }

  async getLastChange(projectId: string, filename: string): Promise<FileChange | null> {
    return await prisma.fileChange.findFirst({
      where: { 
        projectId,
        filename,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}