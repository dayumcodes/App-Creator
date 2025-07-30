import { prisma } from '../lib/database';
import {
  ProjectVersion,
  ProjectVersionWithSnapshots,
  CreateProjectVersionInput,
  UpdateProjectVersionInput,
  NotFoundError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class ProjectVersionRepository {
  async create(data: CreateProjectVersionInput): Promise<ProjectVersion> {
    // If this version is set as active, deactivate all other versions
    if (data.isActive) {
      await prisma.projectVersion.updateMany({
        where: { projectId: data.projectId },
        data: { isActive: false },
      });
    }

    return await prisma.projectVersion.create({
      data,
    });
  }

  async findById(id: string): Promise<ProjectVersion | null> {
    return await prisma.projectVersion.findUnique({
      where: { id },
    });
  }

  async findByIdWithSnapshots(id: string): Promise<ProjectVersionWithSnapshots | null> {
    return await prisma.projectVersion.findUnique({
      where: { id },
      include: {
        snapshots: {
          orderBy: { filename: 'asc' },
        },
      },
    });
  }

  async findByIdOrThrow(id: string): Promise<ProjectVersion> {
    const version = await this.findById(id);
    if (!version) {
      throw new NotFoundError('ProjectVersion', id);
    }
    return version;
  }

  async findByProject(projectId: string): Promise<ProjectVersion[]> {
    return await prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveVersion(projectId: string): Promise<ProjectVersion | null> {
    return await prisma.projectVersion.findFirst({
      where: { 
        projectId,
        isActive: true,
      },
    });
  }

  async update(id: string, data: UpdateProjectVersionInput): Promise<ProjectVersion> {
    try {
      // If setting this version as active, deactivate all others
      if (data.isActive) {
        const version = await this.findByIdOrThrow(id);
        await prisma.projectVersion.updateMany({
          where: { 
            projectId: version.projectId,
            id: { not: id },
          },
          data: { isActive: false },
        });
      }

      return await prisma.projectVersion.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectVersion', id);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<ProjectVersion> {
    try {
      return await prisma.projectVersion.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('ProjectVersion', id);
        }
      }
      throw error;
    }
  }

  async setActiveVersion(id: string): Promise<ProjectVersion> {
    const version = await this.findByIdOrThrow(id);
    
    // Deactivate all other versions for this project
    await prisma.projectVersion.updateMany({
      where: { 
        projectId: version.projectId,
        id: { not: id },
      },
      data: { isActive: false },
    });

    // Activate this version
    return await this.update(id, { isActive: true });
  }

  async getVersionCount(projectId: string): Promise<number> {
    return await prisma.projectVersion.count({
      where: { projectId },
    });
  }

  async createVersionFromCurrentFiles(
    projectId: string,
    name: string,
    description?: string
  ): Promise<ProjectVersionWithSnapshots> {
    // Get current project files
    const currentFiles = await prisma.projectFile.findMany({
      where: { projectId },
    });

    // Create version with snapshots in a transaction
    return await prisma.$transaction(async (tx) => {
      // Deactivate all other versions
      await tx.projectVersion.updateMany({
        where: { projectId },
        data: { isActive: false },
      });

      // Create new version
      const version = await tx.projectVersion.create({
        data: {
          projectId,
          name,
          description,
          isActive: true,
        },
      });

      // Create snapshots for all current files
      const snapshots = await Promise.all(
        currentFiles.map(file =>
          tx.fileSnapshot.create({
            data: {
              versionId: version.id,
              filename: file.filename,
              content: file.content,
              type: file.type,
            },
          })
        )
      );

      return {
        ...version,
        snapshots,
      };
    });
  }
}