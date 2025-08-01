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
import { cacheService } from '../services/CacheService';

export class ProjectRepository {
  async create(data: CreateProjectInput): Promise<Project> {
    return await prisma.project.create({
      data,
    });
  }

  async findById(id: string): Promise<Project | null> {
    // Try cache first
    const cached = await cacheService.getProjectFromCache(id);
    if (cached) {
      return cached;
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    // Cache the result if found
    if (project) {
      await cacheService.cacheProject(id, project);
    }

    return project;
  }

  async findByIdOrThrow(id: string): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundError('Project', id);
    }
    return project;
  }

  async findWithFiles(id: string): Promise<ProjectWithFiles | null> {
    // Try cache first
    const cachedFiles = await cacheService.getProjectFilesFromCache(id);
    const cachedProject = await cacheService.getProjectFromCache(id);
    
    if (cachedProject && cachedFiles) {
      return {
        ...cachedProject,
        files: cachedFiles,
        user: cachedProject.user
      } as ProjectWithFiles;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { filename: 'asc' },
        },
        user: true,
      },
    });

    // Cache the results if found
    if (project) {
      await cacheService.cacheProject(id, project);
      await cacheService.cacheProjectFiles(id, project.files);
    }

    return project;
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
    
    // Only cache simple queries without search
    if (!search && page === 1 && limit === 10) {
      const cached = await cacheService.getUserProjectsFromCache(userId);
      if (cached) {
        return {
          projects: cached,
          total: cached.length,
          page,
          limit,
        };
      }
    }

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

    // Cache simple queries
    if (!search && page === 1 && limit === 10) {
      await cacheService.cacheUserProjects(userId, projects);
    }

    return {
      projects,
      total,
      page,
      limit,
    };
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    try {
      const project = await prisma.project.update({
        where: { id },
        data,
      });

      // Invalidate cache after update
      await cacheService.invalidateProjectCache(id);
      if (project.userId) {
        await cacheService.invalidateUserCache(project.userId);
      }

      return project;
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
      const project = await prisma.project.delete({
        where: { id },
      });

      // Invalidate cache after deletion
      await cacheService.invalidateProjectCache(id);
      if (project.userId) {
        await cacheService.invalidateUserCache(project.userId);
      }

      return project;
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