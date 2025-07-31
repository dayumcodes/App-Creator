import { DeploymentRepository } from '../repositories/DeploymentRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import {
  Deployment,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  DeploymentPlatform,
  DeploymentStatus,
  ProjectFile,
} from '../types/database';
import { NetlifyDeploymentProvider } from './deployment/NetlifyDeploymentProvider';
import { VercelDeploymentProvider } from './deployment/VercelDeploymentProvider';
import { GitHubPagesDeploymentProvider } from './deployment/GitHubPagesDeploymentProvider';

export interface DeploymentProvider {
  deploy(files: ProjectFile[], config: DeploymentConfig): Promise<DeploymentResult>;
  getStatus(deploymentId: string): Promise<DeploymentStatusResult>;
  updateDomain(deploymentId: string, domain: string): Promise<void>;
  rollback(deploymentId: string, targetDeploymentId: string): Promise<DeploymentResult>;
  delete(deploymentId: string): Promise<void>;
}

export interface DeploymentConfig {
  projectName: string;
  buildCommand?: string | undefined;
  outputDir?: string | undefined;
  envVars?: Record<string, string> | undefined;
  customDomain?: string | undefined;
}

export interface DeploymentResult {
  deploymentId: string;
  url: string;
  status: DeploymentStatus;
  errorMessage?: string | undefined;
}

export interface DeploymentStatusResult {
  status: DeploymentStatus;
  url?: string | undefined;
  errorMessage?: string | undefined;
}

export class DeploymentService {
  private providers: Map<DeploymentPlatform, DeploymentProvider>;

  constructor(
    private deploymentRepo: DeploymentRepository,
    private projectRepo: ProjectRepository,
    private projectFileRepo: ProjectFileRepository
  ) {
    this.providers = new Map();
    this.providers.set(DeploymentPlatform.NETLIFY, new NetlifyDeploymentProvider());
    this.providers.set(DeploymentPlatform.VERCEL, new VercelDeploymentProvider());
    this.providers.set(DeploymentPlatform.GITHUB_PAGES, new GitHubPagesDeploymentProvider());
  }

  /**
   * Create a new deployment
   */
  async createDeployment(data: CreateDeploymentInput): Promise<Deployment> {
    // Validate project exists
    const project = await this.projectRepo.findByIdOrThrow(data.projectId);
    
    // Get project files
    const files = await this.projectFileRepo.findByProject(data.projectId);
    if (files.length === 0) {
      throw new Error('Cannot deploy project with no files');
    }

    // Create deployment record
    const deployment = await this.deploymentRepo.create(data);

    // Start deployment process asynchronously
    this.performDeployment(deployment, project.name, files).catch(error => {
      console.error(`Deployment ${deployment.id} failed:`, error);
      this.deploymentRepo.update(deployment.id, {
        status: DeploymentStatus.FAILED,
        errorMessage: error.message || undefined,
      });
    });

    return deployment;
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(id: string): Promise<Deployment> {
    return await this.deploymentRepo.findByIdOrThrow(id);
  }

  /**
   * Get all deployments for a project
   */
  async getProjectDeployments(projectId: string): Promise<Deployment[]> {
    return await this.deploymentRepo.findByProject(projectId);
  }

  /**
   * Get active deployments for a project
   */
  async getActiveDeployments(projectId: string): Promise<Deployment[]> {
    return await this.deploymentRepo.findActiveDeployments(projectId);
  }

  /**
   * Update deployment configuration
   */
  async updateDeployment(id: string, data: UpdateDeploymentInput): Promise<Deployment> {
    const deployment = await this.deploymentRepo.findByIdOrThrow(id);
    
    // If updating custom domain, update it with the provider
    if (data.customDomain && deployment.deploymentId) {
      const provider = this.providers.get(deployment.platform);
      if (provider) {
        try {
          await provider.updateDomain(deployment.deploymentId, data.customDomain);
        } catch (error: any) {
          throw new Error(`Failed to update domain: ${error.message}`);
        }
      }
    }

    return await this.deploymentRepo.update(id, data);
  }

  /**
   * Redeploy a project
   */
  async redeployProject(projectId: string, platform: DeploymentPlatform): Promise<Deployment> {
    // Get the latest deployment configuration
    const latestDeployment = await this.deploymentRepo.findLatestByProjectAndPlatform(
      projectId,
      platform
    );

    const deploymentData: CreateDeploymentInput = {
      projectId,
      platform,
      customDomain: latestDeployment?.customDomain || undefined,
      buildCommand: latestDeployment?.buildCommand || undefined,
      outputDir: latestDeployment?.outputDir || undefined,
      envVars: latestDeployment?.envVars || undefined,
    };

    return await this.createDeployment(deploymentData);
  }

  /**
   * Rollback to a previous deployment
   */
  async rollbackDeployment(deploymentId: string, targetDeploymentId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepo.findByIdOrThrow(deploymentId);
    const targetDeployment = await this.deploymentRepo.findByIdOrThrow(targetDeploymentId);

    if (deployment.projectId !== targetDeployment.projectId) {
      throw new Error('Cannot rollback to deployment from different project');
    }

    if (deployment.platform !== targetDeployment.platform) {
      throw new Error('Cannot rollback to deployment from different platform');
    }

    const provider = this.providers.get(deployment.platform);
    if (!provider || !deployment.deploymentId || !targetDeployment.deploymentId) {
      throw new Error('Rollback not supported for this deployment');
    }

    try {
      // Update deployment status to building
      await this.deploymentRepo.update(deploymentId, {
        status: DeploymentStatus.BUILDING,
      });

      // Perform rollback with provider
      const result = await provider.rollback(deployment.deploymentId, targetDeployment.deploymentId);

      // Update deployment with result
      return await this.deploymentRepo.update(deploymentId, {
        status: result.status,
        url: result.url,
        errorMessage: result.errorMessage,
        deploymentId: result.deploymentId,
      });
    } catch (error: any) {
      // Update deployment with error
      return await this.deploymentRepo.update(deploymentId, {
        status: DeploymentStatus.FAILED,
        errorMessage: error.message || undefined,
      });
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(id: string): Promise<Deployment> {
    const deployment = await this.deploymentRepo.findByIdOrThrow(id);

    // Delete from provider if it exists
    if (deployment.deploymentId) {
      const provider = this.providers.get(deployment.platform);
      if (provider) {
        try {
          await provider.delete(deployment.deploymentId);
        } catch (error) {
          console.warn(`Failed to delete deployment from provider: ${error}`);
        }
      }
    }

    return await this.deploymentRepo.delete(id);
  }

  /**
   * Check deployment status and update if needed
   */
  async checkDeploymentStatus(id: string): Promise<Deployment> {
    const deployment = await this.deploymentRepo.findByIdOrThrow(id);

    if (!deployment.deploymentId || deployment.status === DeploymentStatus.SUCCESS || 
        deployment.status === DeploymentStatus.FAILED) {
      return deployment;
    }

    const provider = this.providers.get(deployment.platform);
    if (!provider) {
      return deployment;
    }

    try {
      const statusResult = await provider.getStatus(deployment.deploymentId);
      
      // Update deployment if status changed
      if (statusResult.status !== deployment.status) {
        return await this.deploymentRepo.update(id, {
          status: statusResult.status,
          url: statusResult.url || deployment.url || undefined,
          errorMessage: statusResult.errorMessage || undefined,
        });
      }

      return deployment;
    } catch (error) {
      console.error(`Failed to check deployment status: ${error}`);
      return deployment;
    }
  }

  /**
   * Perform the actual deployment
   */
  private async performDeployment(
    deployment: Deployment,
    projectName: string,
    files: ProjectFile[]
  ): Promise<void> {
    const provider = this.providers.get(deployment.platform);
    if (!provider) {
      throw new Error(`Unsupported deployment platform: ${deployment.platform}`);
    }

    // Update status to building
    await this.deploymentRepo.update(deployment.id, {
      status: DeploymentStatus.BUILDING,
    });

    const config: DeploymentConfig = {
      projectName,
      buildCommand: deployment.buildCommand || undefined,
      outputDir: deployment.outputDir || undefined,
      envVars: deployment.envVars || undefined,
      customDomain: deployment.customDomain || undefined,
    };

    try {
      const result = await provider.deploy(files, config);

      await this.deploymentRepo.update(deployment.id, {
        status: result.status,
        url: result.url,
        deploymentId: result.deploymentId,
        errorMessage: result.errorMessage || undefined,
      });
    } catch (error: any) {
      await this.deploymentRepo.update(deployment.id, {
        status: DeploymentStatus.FAILED,
        errorMessage: error.message || undefined,
      });
      throw error;
    }
  }
}