import { prisma } from '../lib/database';
import {
  FileSnapshot,
  CreateFileSnapshotInput,
  NotFoundError,
  DuplicateError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class FileSnapshotRepository {
  async create(data: CreateFileSnapshotInput): Promise<FileSnapshot> {
    try {
      return await prisma.fileSnapshot.create({
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new DuplicateError('FileSnapshot', 'filename');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<FileSnapshot | null> {
    return await prisma.fileSnapshot.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<FileSnapshot> {
    const snapshot = await this.findById(id);
    if (!snapshot) {
      throw new NotFoundError('FileSnapshot', id);
    }
    return snapshot;
  }

  async findByVersion(versionId: string): Promise<FileSnapshot[]> {
    return await prisma.fileSnapshot.findMany({
      where: { versionId },
      orderBy: { filename: 'asc' },
    });
  }

  async findByVersionAndFilename(
    versionId: string,
    filename: string
  ): Promise<FileSnapshot | null> {
    return await prisma.fileSnapshot.findUnique({
      where: {
        versionId_filename: {
          versionId,
          filename,
        },
      },
    });
  }

  async delete(id: string): Promise<FileSnapshot> {
    try {
      return await prisma.fileSnapshot.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('FileSnapshot', id);
        }
      }
      throw error;
    }
  }

  async deleteAllByVersion(versionId: string): Promise<number> {
    const result = await prisma.fileSnapshot.deleteMany({
      where: { versionId },
    });
    return result.count;
  }

  async createBatch(snapshots: CreateFileSnapshotInput[]): Promise<FileSnapshot[]> {
    return await prisma.$transaction(
      snapshots.map(snapshot => 
        prisma.fileSnapshot.create({ data: snapshot })
      )
    );
  }

  async getSnapshotCount(versionId: string): Promise<number> {
    return await prisma.fileSnapshot.count({
      where: { versionId },
    });
  }
}