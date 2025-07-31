import axios from 'axios';
import FormData from 'form-data';
import { ProjectFile, DeploymentStatus } from '../../types/database';
import {
  DeploymentProvider,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
} from '../DeploymentService';

interface NetlifyDeployment {
  id: string;
  url: string;
  deploy_url: string;
  state: 'new' | 'building' | 'ready' | 'error' | 'cancelled';
  error_message?: string;
}

interface NetlifySite {
  id: string;
  name: string;
  url: string;
  custom_domain?: string;
}

export class NetlifyDeploymentProvider implements DeploymentProvider {
  private apiToken: string;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor() {
    this.apiToken = process.env['NETLIFY_API_TOKEN'] || '';
    if (!this.apiToken) {
      throw new Error('NETLIFY_API_TOKEN environment variable is required');
    }
  }

  async deploy(files: ProjectFile[], config: DeploymentConfig): Promise<DeploymentResult> {
    try {
      // Create or get site
      const site = await this.createOrGetSite(config.projectName);

      // Prepare files for deployment
      const fileMap = this.prepareFiles(files, config);

      // Create deployment
      const deployment = await this.createDeployment(site.id, fileMap);

      return {
        deploymentId: deployment.id,
        url: deployment.deploy_url,
        status: this.mapNetlifyStatus(deployment.state),
        errorMessage: deployment.error_message || undefined,
      };
    } catch (error: any) {
      throw new Error(`Netlify deployment failed: ${error.message}`);
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatusResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/deploys/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const deployment: NetlifyDeployment = response.data;

      return {
        status: this.mapNetlifyStatus(deployment.state),
        url: deployment.deploy_url,
        errorMessage: deployment.error_message || undefined,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Netlify deployment status: ${error.message}`);
    }
  }

  async updateDomain(deploymentId: string, domain: string): Promise<void> {
    try {
      // Get the site ID from the deployment
      const deployResponse = await axios.get(`${this.baseUrl}/deploys/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const siteId = deployResponse.data.site_id;

      // Update the site's custom domain
      await axios.patch(`${this.baseUrl}/sites/${siteId}`, {
        custom_domain: domain,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to update Netlify domain: ${error.message}`);
    }
  }

  async rollback(deploymentId: string, targetDeploymentId: string): Promise<DeploymentResult> {
    try {
      // Get the site ID from the current deployment
      const deployResponse = await axios.get(`${this.baseUrl}/deploys/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const siteId = deployResponse.data.site_id;

      // Restore the target deployment
      const response = await axios.post(`${this.baseUrl}/sites/${siteId}/deploys/${targetDeploymentId}/restore`, {}, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const deployment: NetlifyDeployment = response.data;

      return {
        deploymentId: deployment.id,
        url: deployment.deploy_url,
        status: this.mapNetlifyStatus(deployment.state),
        errorMessage: deployment.error_message || undefined,
      };
    } catch (error: any) {
      throw new Error(`Failed to rollback Netlify deployment: ${error.message}`);
    }
  }

  async delete(deploymentId: string): Promise<void> {
    try {
      // Get the site ID from the deployment
      const deployResponse = await axios.get(`${this.baseUrl}/deploys/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      const siteId = deployResponse.data.site_id;

      // Delete the site (this will delete all deployments)
      await axios.delete(`${this.baseUrl}/sites/${siteId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to delete Netlify deployment: ${error.message}`);
    }
  }

  private async createOrGetSite(projectName: string): Promise<NetlifySite> {
    try {
      // Try to find existing site by name
      const sitesResponse = await axios.get(`${this.baseUrl}/sites`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
        params: {
          filter: 'all',
        },
      });

      const existingSite = sitesResponse.data.find((site: NetlifySite) => 
        site.name === projectName
      );

      if (existingSite) {
        return existingSite;
      }

      // Create new site
      const response = await axios.post(`${this.baseUrl}/sites`, {
        name: projectName,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create or get Netlify site: ${error.message}`);
    }
  }

  private async createDeployment(siteId: string, files: Record<string, string>): Promise<NetlifyDeployment> {
    try {
      const formData = new FormData();

      // Add files to form data
      Object.entries(files).forEach(([path, content]) => {
        formData.append(path, content);
      });

      const response = await axios.post(`${this.baseUrl}/sites/${siteId}/deploys`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          ...formData.getHeaders(),
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create Netlify deployment: ${error.message}`);
    }
  }

  private prepareFiles(files: ProjectFile[], config: DeploymentConfig): Record<string, string> {
    const fileMap: Record<string, string> = {};

    // Add project files
    files.forEach(file => {
      fileMap[file.filename] = file.content;
    });

    // Add build configuration if specified
    if (config.buildCommand || config.outputDir) {
      const netlifyToml = this.generateNetlifyToml(config);
      fileMap['netlify.toml'] = netlifyToml;
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

  private generateNetlifyToml(config: DeploymentConfig): string {
    const sections: string[] = [];

    sections.push('[build]');
    
    if (config.buildCommand) {
      sections.push(`  command = "${config.buildCommand}"`);
    }
    
    if (config.outputDir) {
      sections.push(`  publish = "${config.outputDir}"`);
    }

    if (config.envVars && Object.keys(config.envVars).length > 0) {
      sections.push('');
      sections.push('[build.environment]');
      Object.entries(config.envVars).forEach(([key, value]) => {
        sections.push(`  ${key} = "${value}"`);
      });
    }

    return sections.join('\n');
  }

  private mapNetlifyStatus(netlifyStatus: string): DeploymentStatus {
    switch (netlifyStatus) {
      case 'new':
        return DeploymentStatus.PENDING;
      case 'building':
        return DeploymentStatus.BUILDING;
      case 'ready':
        return DeploymentStatus.SUCCESS;
      case 'error':
        return DeploymentStatus.FAILED;
      case 'cancelled':
        return DeploymentStatus.CANCELLED;
      default:
        return DeploymentStatus.PENDING;
    }
  }
}