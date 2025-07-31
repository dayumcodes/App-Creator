import { api } from './api';

export interface Deployment {
  id: string;
  projectId: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  url?: string;
  customDomain?: string;
  buildCommand?: string;
  outputDir?: string;
  envVars?: Record<string, string>;
  errorMessage?: string;
  deploymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export enum DeploymentPlatform {
  NETLIFY = 'NETLIFY',
  VERCEL = 'VERCEL',
  GITHUB_PAGES = 'GITHUB_PAGES',
}

export enum DeploymentStatus {
  PENDING = 'PENDING',
  BUILDING = 'BUILDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface CreateDeploymentRequest {
  projectId: string;
  platform: DeploymentPlatform;
  customDomain?: string;
  buildCommand?: string;
  outputDir?: string;
  envVars?: Record<string, string>;
}

export interface UpdateDeploymentRequest {
  customDomain?: string;
  buildCommand?: string;
  outputDir?: string;
  envVars?: Record<string, string>;
}

export interface RedeployRequest {
  platform: DeploymentPlatform;
}

export interface RollbackRequest {
  targetDeploymentId: string;
}

export const deploymentApi = {
  // Create a new deployment
  async createDeployment(data: CreateDeploymentRequest): Promise<Deployment> {
    const response = await api.post('/deployments', data);
    return response.data.data;
  },

  // Get deployment by ID
  async getDeployment(id: string): Promise<Deployment> {
    const response = await api.get(`/deployments/${id}`);
    return response.data.data;
  },

  // Get all deployments for a project
  async getProjectDeployments(projectId: string): Promise<Deployment[]> {
    const response = await api.get(`/deployments/project/${projectId}`);
    return response.data.data;
  },

  // Get active deployments for a project
  async getActiveDeployments(projectId: string): Promise<Deployment[]> {
    const response = await api.get(`/deployments/project/${projectId}/active`);
    return response.data.data;
  },

  // Update deployment
  async updateDeployment(id: string, data: UpdateDeploymentRequest): Promise<Deployment> {
    const response = await api.put(`/deployments/${id}`, data);
    return response.data.data;
  },

  // Redeploy project
  async redeployProject(projectId: string, data: RedeployRequest): Promise<Deployment> {
    const response = await api.post(`/deployments/project/${projectId}/redeploy`, data);
    return response.data.data;
  },

  // Rollback deployment
  async rollbackDeployment(id: string, data: RollbackRequest): Promise<Deployment> {
    const response = await api.post(`/deployments/${id}/rollback`, data);
    return response.data.data;
  },

  // Delete deployment
  async deleteDeployment(id: string): Promise<Deployment> {
    const response = await api.delete(`/deployments/${id}`);
    return response.data.data;
  },
};