import axios from 'axios';
import { ProjectFile, DeploymentStatus } from '../../types/database';
import {
  DeploymentProvider,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
} from '../DeploymentService';

interface VercelDeployment {
  uid: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  readyState: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  errorMessage?: string;
}



export class VercelDeploymentProvider implements DeploymentProvider {
  private apiToken: string;
  private baseUrl = 'https://api.vercel.com';

  constructor() {
    this.apiToken = process.env['VERCEL_API_TOKEN'] || '';
    if (!this.apiToken) {
      throw new Error('VERCEL_API_TOKEN environment variable is required');
    }
  }

  async deploy(files: ProjectFile[], config: DeploymentConfig): Promise<DeploymentResult> {
    try {
      // Prepare files for deployment
      const fileMap = this.prepareFiles(files, config);

      // Create deployment
      const deployment = await this.createDeployment(config.projectName, fileMap, config);

      return {
        deploymentId: deployment.uid,
        url: `https://${deployment.url}`,
        status: this.mapVercelStatus(deployment.readyState),
        errorMessage: deployment.errorMessage || undefined,
      };
    } catch (error: any) {
      throw new Error(`Vercel deployment failed: ${error.message}`);
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatusResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const deployment: VercelDeployment = response.data;

      return {
        status: this.mapVercelStatus(deployment.readyState),
        url: `https://${deployment.url}`,
        errorMessage: deployment.errorMessage || undefined,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Vercel deployment status: ${error.message}`);
    }
  }

  async updateDomain(deploymentId: string, domain: string): Promise<void> {
    try {
      // Get the deployment to find the project
      const deployResponse = await axios.get(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const projectId = deployResponse.data.projectId;

      // Add domain to project
      await axios.post(`${this.baseUrl}/v9/projects/${projectId}/domains`, {
        name: domain,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to update Vercel domain: ${error.message}`);
    }
  }

  async rollback(deploymentId: string, targetDeploymentId: string): Promise<DeploymentResult> {
    try {
      // Get the current deployment to find the project
      const deployResponse = await axios.get(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const projectId = deployResponse.data.projectId;

      // Promote the target deployment
      const response = await axios.patch(`${this.baseUrl}/v9/projects/${projectId}/deployments/${targetDeploymentId}/promote`, {}, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const deployment: VercelDeployment = response.data;

      return {
        deploymentId: deployment.uid,
        url: `https://${deployment.url}`,
        status: this.mapVercelStatus(deployment.readyState),
        errorMessage: deployment.errorMessage || undefined,
      };
    } catch (error: any) {
      throw new Error(`Failed to rollback Vercel deployment: ${error.message}`);
    }
  }

  async delete(deploymentId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to delete Vercel deployment: ${error.message}`);
    }
  }

  private async createDeployment(
    projectName: string,
    files: Record<string, string>,
    config: DeploymentConfig
  ): Promise<VercelDeployment> {
    try {
      // Prepare deployment payload
      const deploymentData = {
        name: projectName,
        files: Object.entries(files).map(([file, data]) => ({
          file,
          data: Buffer.from(data).toString('base64'),
          encoding: 'base64',
        })),
        projectSettings: {
          buildCommand: config.buildCommand,
          outputDirectory: config.outputDir,
        },
        env: config.envVars || {},
      };

      const response = await axios.post(`${this.baseUrl}/v13/deployments`, deploymentData, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create Vercel deployment: ${error.message}`);
    }
  }

  private prepareFiles(files: ProjectFile[], config: DeploymentConfig): Record<string, string> {
    const fileMap: Record<string, string> = {};

    // Add project files
    files.forEach(file => {
      fileMap[file.filename] = file.content;
    });

    // Add Vercel configuration if needed
    if (config.buildCommand || config.outputDir || config.envVars) {
      const vercelJson = this.generateVercelJson(config);
      fileMap['vercel.json'] = vercelJson;
    }

    // Ensure there's an index.html
    if (!fileMap['index.html'] && !fileMap['index.htm']) {
      const htmlFile = files.find(f => f.type === 'HTML');
      if (htmlFile && htmlFile.filename !== 'index.html') {
        fileMap['index.html'] = htmlFile.content;
      }
    }

    return fileMap;
  }

  private generateVercelJson(config: DeploymentConfig): string {
    const vercelConfig: any = {
      version: 2,
    };

    if (config.buildCommand || config.outputDir) {
      vercelConfig.builds = [{
        src: '**/*',
        use: '@vercel/static',
      }];

      if (config.buildCommand) {
        vercelConfig.builds[0].config = {
          buildCommand: config.buildCommand,
        };
      }

      if (config.outputDir) {
        vercelConfig.builds[0].config = {
          ...vercelConfig.builds[0].config,
          distDir: config.outputDir,
        };
      }
    }

    if (config.envVars && Object.keys(config.envVars).length > 0) {
      vercelConfig.env = config.envVars;
    }

    return JSON.stringify(vercelConfig, null, 2);
  }

  private mapVercelStatus(vercelStatus: string): DeploymentStatus {
    switch (vercelStatus) {
      case 'INITIALIZING':
      case 'QUEUED':
        return DeploymentStatus.PENDING;
      case 'BUILDING':
        return DeploymentStatus.BUILDING;
      case 'READY':
        return DeploymentStatus.SUCCESS;
      case 'ERROR':
        return DeploymentStatus.FAILED;
      case 'CANCELED':
        return DeploymentStatus.CANCELLED;
      default:
        return DeploymentStatus.PENDING;
    }
  }
}