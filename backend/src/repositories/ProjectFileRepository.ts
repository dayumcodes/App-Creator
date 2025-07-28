import { prisma } from '../lib/database';
import {
  ProjectFile,
  CreateProjectFileInput,
  UpdateProjectFileInput,
  NotFoundError,
  DuplicateError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class ProjectFileRepository {
  async create(data: CreateProjectFileInput): Promise<ProjectFile> {
    try {
      return await prisma.projectFile.create({
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new DuplicateError('ProjectFile', 'filename');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ProjectFile | null> {
    return await prisma.projectFile.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<ProjectFile> {
    const file = await this.findById(id);
    if (!file) {
      throw new NotFoundError('ProjectFile', id);
    }
    return file;
  }

  async findByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<ProjectFile | null> {
    return await prisma.projectFile.findUnique({
      where: {
        projectId_filename: {
          projectId,
          filename,
        },
      },
    });
  }

  async findByProject(projectId: string): Promise<ProjectFile[]> {
    return await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { filename: 'asc' },
    });
  }

  async update(id: string, data: UpdateProjectFileInput): Promise<ProjectFile> {
    try {
      return await prisma.projectFile.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectFile', id);
        }
        if (error.code === 'P2002') {
          throw new DuplicateError('ProjectFile', 'filename');
        }
      }
      throw error;
    }
  }

  async updateByProjectAndFilename(
    projectId: string,
    filename: string,
    data: Omit<UpdateProjectFileInput, 'filename'>
  ): Promise<ProjectFile> {
    try {
      return await prisma.projectFile.update({
        where: {
          projectId_filename: {
            projectId,
            filename,
          },
        },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectFile', `${projectId}/${filename}`);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<ProjectFile> {
    try {
      return await prisma.projectFile.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectFile', id);
        }
      }
      throw error;
    }
  }

  async deleteByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<ProjectFile> {
    try {
      return await prisma.projectFile.delete({
        where: {
          projectId_filename: {
            projectId,
            filename,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectFile', `${projectId}/${filename}`);
        }
      }
      throw error;
    }
  }

  async deleteAllByProject(projectId: string): Promise<number> {
    const result = await prisma.projectFile.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.projectFile.count({
      where: { id },
    });
    return count > 0;
  }

  async existsByProjectAndFilename(
    projectId: string,
    filename: string
  ): Promise<boolean> {
    const count = await prisma.projectFile.count({
      where: {
        projectId,
        filename,
      },
    });
    return count > 0;
  }

  async getFileCount(projectId: string): Promise<number> {
    return await prisma.projectFile.count({
      where: { projectId },
    });
  }

  async createOrUpdate(data: CreateProjectFileInput): Promise<ProjectFile> {
    const existing = await this.findByProjectAndFilename(
      data.projectId,
      data.filename
    );

    if (existing) {
      return await this.update(existing.id, {
        content: data.content,
        type: data.type,
      });
    } else {
      return await this.create(data);
    }
  }
}