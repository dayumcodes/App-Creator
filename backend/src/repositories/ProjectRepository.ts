import { prisma } from '../lib/database';
import {
  Project,
  ProjectWithFiles,
  ProjectWithAll,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectListOptions,
  NotFoundError,
} from '../types/database';
import { Prisma } from '../generated/prisma';

export class ProjectRepository {
  async create(data: CreateProjectInput): Promise<Project> {
    return await prisma.project.create({
      data,
    });
  }

  async findById(id: string): Promise<Project | null> {
    return await prisma.project.findUnique({
      where: { id },
    });
  }

  async findByIdOrThrow(id: string): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundError('Project', id);
    }
    return project;
  }

  async findWithFiles(id: string): Promise<ProjectWithFiles | null> {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { filename: 'asc' },
        },
        user: true,
      },
    });
  }

  async findWithAll(id: string): Promise<ProjectWithAll | null> {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { filename: 'asc' },
        },
        prompts: {
          orderBy: { createdAt: 'desc' },
        },
        user: true,
      },
    });
  }

  async findByUser(options: ProjectListOptions): Promise<{
    projects: Project[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, search, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      projects,
      total,
      page,
      limit,
    };
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    try {
      return await prisma.project.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('Project', id);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<Project> {
    try {
      return await prisma.project.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundError('Project', id);
        }
      }
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.project.count({
      where: { id },
    });
    return count > 0;
  }

  async belongsToUser(projectId: string, userId: string): Promise<boolean> {
    const count = await prisma.project.count({
      where: {
        id: projectId,
        userId,
      },
    });
    return count > 0;
  }

  async getProjectCount(userId: string): Promise<number> {
    return await prisma.project.count({
      where: { userId },
    });
  }
}