import { PrismaClient } from '../generated/prisma';
import {
  Deployment,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  DeploymentPlatform,
  DeploymentStatus,
  NotFoundError,
  DatabaseError,
} from '../types/database';

export class DeploymentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateDeploymentInput): Promise<Deployment> {
    try {
      const deployment = await this.prisma.deployment.create({
        data: {
          projectId: data.projectId,
          platform: data.platform,
          customDomain: data.customDomain,
          buildCommand: data.buildCommand,
          outputDir: data.outputDir,
          envVars: data.envVars ? JSON.stringify(data.envVars) : null,
        },
      });

      return {
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      } as Deployment;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new DatabaseError('Deployment already exists', 'DUPLICATE');
      }
      throw new DatabaseError(`Failed to create deployment: ${error.message}`);
    }
  }

  async findById(id: string): Promise<Deployment | null> {
    try {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id },
      });

      if (!deployment) {
        return null;
      }

      return {
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      } as Deployment;
    } catch (error: any) {
      throw new DatabaseError(`Failed to find deployment: ${error.message}`);
    }
  }

  async findByIdOrThrow(id: string): Promise<Deployment> {
    const deployment = await this.findById(id);
    if (!deployment) {
      throw new NotFoundError('Deployment', id);
    }
    return deployment;
  }

  async findByProject(projectId: string): Promise<Deployment[]> {
    try {
      const deployments = await this.prisma.deployment.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return deployments.map(deployment => ({
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      })) as Deployment[];
    } catch (error: any) {
      throw new DatabaseError(`Failed to find deployments: ${error.message}`);
    }
  }

  async findByProjectAndPlatform(
    projectId: string,
    platform: DeploymentPlatform
  ): Promise<Deployment[]> {
    try {
      const deployments = await this.prisma.deployment.findMany({
        where: { 
          projectId,
          platform,
        },
        orderBy: { createdAt: 'desc' },
      });

      return deployments.map(deployment => ({
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      })) as Deployment[];
    } catch (error: any) {
      throw new DatabaseError(`Failed to find deployments: ${error.message}`);
    }
  }

  async findLatestByProjectAndPlatform(
    projectId: string,
    platform: DeploymentPlatform
  ): Promise<Deployment | null> {
    try {
      const deployment = await this.prisma.deployment.findFirst({
        where: { 
          projectId,
          platform,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!deployment) {
        return null;
      }

      return {
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      } as Deployment;
    } catch (error: any) {
      throw new DatabaseError(`Failed to find latest deployment: ${error.message}`);
    }
  }

  async findActiveDeployments(projectId: string): Promise<Deployment[]> {
    try {
      const deployments = await this.prisma.deployment.findMany({
        where: { 
          projectId,
          status: DeploymentStatus.SUCCESS,
        },
        orderBy: { createdAt: 'desc' },
      });

      return deployments.map(deployment => ({
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      })) as Deployment[];
    } catch (error: any) {
      throw new DatabaseError(`Failed to find active deployments: ${error.message}`);
    }
  }

  async update(id: string, data: UpdateDeploymentInput): Promise<Deployment> {
    try {
      const deployment = await this.prisma.deployment.update({
        where: { id },
        data: {
          status: data.status,
          url: data.url,
          customDomain: data.customDomain,
          buildCommand: data.buildCommand,
          outputDir: data.outputDir,
          envVars: data.envVars ? JSON.stringify(data.envVars) : undefined,
          errorMessage: data.errorMessage,
          deploymentId: data.deploymentId,
        },
      });

      return {
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      } as Deployment;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Deployment', id);
      }
      throw new DatabaseError(`Failed to update deployment: ${error.message}`);
    }
  }

  async delete(id: string): Promise<Deployment> {
    try {
      const deployment = await this.prisma.deployment.delete({
        where: { id },
      });

      return {
        ...deployment,
        envVars: deployment.envVars ? JSON.parse(deployment.envVars as string) : undefined,
      } as Deployment;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError('Deployment', id);
      }
      throw new DatabaseError(`Failed to delete deployment: ${error.message}`);
    }
  }

  async deleteByProject(projectId: string): Promise<number> {
    try {
      const result = await this.prisma.deployment.deleteMany({
        where: { projectId },
      });
      return result.count;
    } catch (error: any) {
      throw new DatabaseError(`Failed to delete deployments: ${error.message}`);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.deployment.count({
        where: { id },
      });
      return count > 0;
    } catch (error: any) {
      throw new DatabaseError(`Failed to check deployment existence: ${error.message}`);
    }
  }

  async getDeploymentCount(projectId: string): Promise<number> {
    try {
      return await this.prisma.deployment.count({
        where: { projectId },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to count deployments: ${error.message}`);
    }
  }

  async getSuccessfulDeploymentCount(projectId: string): Promise<number> {
    try {
      return await this.prisma.deployment.count({
        where: { 
          projectId,
          status: DeploymentStatus.SUCCESS,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to count successful deployments: ${error.message}`);
    }
  }
}