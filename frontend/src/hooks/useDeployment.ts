import { useState, useEffect, useCallback } from 'react';
import {
  deploymentApi,
  Deployment,
  DeploymentPlatform,
  DeploymentStatus,
  CreateDeploymentRequest,
  UpdateDeploymentRequest,
  RedeployRequest,
  RollbackRequest,
} from '../services/deploymentApi';

export interface UseDeploymentResult {
  deployments: Deployment[];
  activeDeployments: Deployment[];
  loading: boolean;
  error: string | null;
  createDeployment: (data: CreateDeploymentRequest) => Promise<Deployment | null>;
  updateDeployment: (id: string, data: UpdateDeploymentRequest) => Promise<Deployment | null>;
  redeployProject: (projectId: string, platform: DeploymentPlatform) => Promise<Deployment | null>;
  rollbackDeployment: (id: string, targetId: string) => Promise<Deployment | null>;
  deleteDeployment: (id: string) => Promise<boolean>;
  refreshDeployments: () => Promise<void>;
  getDeploymentStatus: (id: string) => Promise<Deployment | null>;
}

export const useDeployment = (projectId?: string): UseDeploymentResult => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeDeployments, setActiveDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch deployments for a project
  const fetchDeployments = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const [allDeployments, activeDeploymentsData] = await Promise.all([
        deploymentApi.getProjectDeployments(projectId),
        deploymentApi.getActiveDeployments(projectId),
      ]);

      setDeployments(allDeployments);
      setActiveDeployments(activeDeploymentsData);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch deployments');
      console.error('Error fetching deployments:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Create a new deployment
  const createDeployment = useCallback(async (data: CreateDeploymentRequest): Promise<Deployment | null> => {
    setLoading(true);
    setError(null);

    try {
      const deployment = await deploymentApi.createDeployment(data);
      
      // Add to deployments list
      setDeployments(prev => [deployment, ...prev]);
      
      // Start polling for status updates
      pollDeploymentStatus(deployment.id);
      
      return deployment;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create deployment');
      console.error('Error creating deployment:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update deployment
  const updateDeployment = useCallback(async (id: string, data: UpdateDeploymentRequest): Promise<Deployment | null> => {
    setLoading(true);
    setError(null);

    try {
      const updatedDeployment = await deploymentApi.updateDeployment(id, data);
      
      // Update in deployments list
      setDeployments(prev => 
        prev.map(d => d.id === id ? updatedDeployment : d)
      );
      
      // Update in active deployments if it's there
      setActiveDeployments(prev => 
        prev.map(d => d.id === id ? updatedDeployment : d)
      );
      
      return updatedDeployment;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update deployment');
      console.error('Error updating deployment:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Redeploy project
  const redeployProject = useCallback(async (projectId: string, platform: DeploymentPlatform): Promise<Deployment | null> => {
    setLoading(true);
    setError(null);

    try {
      const deployment = await deploymentApi.redeployProject(projectId, { platform });
      
      // Add to deployments list
      setDeployments(prev => [deployment, ...prev]);
      
      // Start polling for status updates
      pollDeploymentStatus(deployment.id);
      
      return deployment;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to redeploy project');
      console.error('Error redeploying project:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Rollback deployment
  const rollbackDeployment = useCallback(async (id: string, targetId: string): Promise<Deployment | null> => {
    setLoading(true);
    setError(null);

    try {
      const deployment = await deploymentApi.rollbackDeployment(id, { targetDeploymentId: targetId });
      
      // Update in deployments list
      setDeployments(prev => 
        prev.map(d => d.id === id ? deployment : d)
      );
      
      // Start polling for status updates
      pollDeploymentStatus(deployment.id);
      
      return deployment;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to rollback deployment');
      console.error('Error rolling back deployment:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete deployment
  const deleteDeployment = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await deploymentApi.deleteDeployment(id);
      
      // Remove from deployments list
      setDeployments(prev => prev.filter(d => d.id !== id));
      setActiveDeployments(prev => prev.filter(d => d.id !== id));
      
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete deployment');
      console.error('Error deleting deployment:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get deployment status
  const getDeploymentStatus = useCallback(async (id: string): Promise<Deployment | null> => {
    try {
      const deployment = await deploymentApi.getDeployment(id);
      
      // Update in deployments list
      setDeployments(prev => 
        prev.map(d => d.id === id ? deployment : d)
      );
      
      // Update in active deployments if it's there and successful
      if (deployment.status === DeploymentStatus.SUCCESS) {
        setActiveDeployments(prev => {
          const exists = prev.some(d => d.id === id);
          if (exists) {
            return prev.map(d => d.id === id ? deployment : d);
          } else {
            return [...prev, deployment];
          }
        });
      } else {
        // Remove from active deployments if not successful
        setActiveDeployments(prev => prev.filter(d => d.id !== id));
      }
      
      return deployment;
    } catch (err: any) {
      console.error('Error getting deployment status:', err);
      return null;
    }
  }, []);

  // Poll deployment status for building deployments
  const pollDeploymentStatus = useCallback((deploymentId: string) => {
    const pollInterval = setInterval(async () => {
      const deployment = await getDeploymentStatus(deploymentId);
      
      if (deployment && (
        deployment.status === DeploymentStatus.SUCCESS ||
        deployment.status === DeploymentStatus.FAILED ||
        deployment.status === DeploymentStatus.CANCELLED
      )) {
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds

    // Clear interval after 10 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 10 * 60 * 1000);
  }, [getDeploymentStatus]);

  // Refresh deployments
  const refreshDeployments = useCallback(async () => {
    await fetchDeployments();
  }, [fetchDeployments]);

  // Fetch deployments on mount and when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchDeployments();
    }
  }, [projectId, fetchDeployments]);

  return {
    deployments,
    activeDeployments,
    loading,
    error,
    createDeployment,
    updateDeployment,
    redeployProject,
    rollbackDeployment,
    deleteDeployment,
    refreshDeployments,
    getDeploymentStatus,
  };
};