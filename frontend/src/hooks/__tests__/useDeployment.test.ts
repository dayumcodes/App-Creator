import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useDeployment } from '../useDeployment';
import { deploymentApi, DeploymentPlatform, DeploymentStatus } from '../../services/deploymentApi';

// Mock the deployment API
vi.mock('../../services/deploymentApi');

const mockDeploymentApi = deploymentApi as any;

describe('useDeployment', () => {
  const mockDeployment = {
    id: 'deployment-1',
    projectId: 'project-1',
    platform: DeploymentPlatform.NETLIFY,
    status: DeploymentStatus.PENDING,
    url: 'https://example.netlify.app',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  };

  const mockActiveDeployment = {
    ...mockDeployment,
    id: 'deployment-2',
    status: DeploymentStatus.SUCCESS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch deployments on mount', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([mockActiveDeployment]);

    const { result } = renderHook(() => useDeployment('project-1'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.deployments).toEqual([mockDeployment]);
    expect(result.current.activeDeployments).toEqual([mockActiveDeployment]);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error', async () => {
    const errorMessage = 'Failed to fetch deployments';
    mockDeploymentApi.getProjectDeployments = vi.fn().mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.deployments).toEqual([]);
    expect(result.current.activeDeployments).toEqual([]);
  });

  it('should create deployment successfully', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.createDeployment = vi.fn().mockResolvedValue(mockDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const deploymentData = {
      projectId: 'project-1',
      platform: DeploymentPlatform.NETLIFY,
    };

    let createdDeployment;
    await act(async () => {
      createdDeployment = await result.current.createDeployment(deploymentData);
    });

    expect(mockDeploymentApi.createDeployment).toHaveBeenCalledWith(deploymentData);
    expect(createdDeployment).toEqual(mockDeployment);
    expect(result.current.deployments).toContain(mockDeployment);
  });

  it('should handle create deployment error', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    
    const errorMessage = 'Failed to create deployment';
    mockDeploymentApi.createDeployment = vi.fn().mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const deploymentData = {
      projectId: 'project-1',
      platform: DeploymentPlatform.NETLIFY,
    };

    let createdDeployment;
    await act(async () => {
      createdDeployment = await result.current.createDeployment(deploymentData);
    });

    expect(createdDeployment).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  it('should update deployment successfully', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);

    const updatedDeployment = { ...mockDeployment, customDomain: 'example.com' };
    mockDeploymentApi.updateDeployment = vi.fn().mockResolvedValue(updatedDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateData = { customDomain: 'example.com' };

    let updatedResult;
    await act(async () => {
      updatedResult = await result.current.updateDeployment('deployment-1', updateData);
    });

    expect(mockDeploymentApi.updateDeployment).toHaveBeenCalledWith('deployment-1', updateData);
    expect(updatedResult).toEqual(updatedDeployment);
    expect(result.current.deployments[0]).toEqual(updatedDeployment);
  });

  it('should redeploy project successfully', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.redeployProject = vi.fn().mockResolvedValue(mockDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let redeployedDeployment;
    await act(async () => {
      redeployedDeployment = await result.current.redeployProject('project-1', DeploymentPlatform.NETLIFY);
    });

    expect(mockDeploymentApi.redeployProject).toHaveBeenCalledWith('project-1', {
      platform: DeploymentPlatform.NETLIFY,
    });
    expect(redeployedDeployment).toEqual(mockDeployment);
    expect(result.current.deployments).toContain(mockDeployment);
  });

  it('should rollback deployment successfully', async () => {
    const rolledBackDeployment = { ...mockDeployment, status: DeploymentStatus.BUILDING };
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.rollbackDeployment = vi.fn().mockResolvedValue(rolledBackDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let rolledBackResult;
    await act(async () => {
      rolledBackResult = await result.current.rollbackDeployment('deployment-1', 'target-deployment-1');
    });

    expect(mockDeploymentApi.rollbackDeployment).toHaveBeenCalledWith('deployment-1', {
      targetDeploymentId: 'target-deployment-1',
    });
    expect(rolledBackResult).toEqual(rolledBackDeployment);
    expect(result.current.deployments[0]).toEqual(rolledBackDeployment);
  });

  it('should delete deployment successfully', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.deleteDeployment = vi.fn().mockResolvedValue(mockDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteDeployment('deployment-1');
    });

    expect(mockDeploymentApi.deleteDeployment).toHaveBeenCalledWith('deployment-1');
    expect(deleteResult).toBe(true);
    expect(result.current.deployments).not.toContain(mockDeployment);
  });

  it('should get deployment status and update state', async () => {
    const updatedDeployment = { ...mockDeployment, status: DeploymentStatus.SUCCESS };
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([]);
    mockDeploymentApi.getDeployment = vi.fn().mockResolvedValue(updatedDeployment);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let statusResult;
    await act(async () => {
      statusResult = await result.current.getDeploymentStatus('deployment-1');
    });

    expect(mockDeploymentApi.getDeployment).toHaveBeenCalledWith('deployment-1');
    expect(statusResult).toEqual(updatedDeployment);
    expect(result.current.deployments[0]).toEqual(updatedDeployment);
    expect(result.current.activeDeployments).toContain(updatedDeployment);
  });

  it('should refresh deployments', async () => {
    mockDeploymentApi.getProjectDeployments = vi.fn().mockResolvedValue([mockDeployment]);
    mockDeploymentApi.getActiveDeployments = vi.fn().mockResolvedValue([mockActiveDeployment]);

    const { result } = renderHook(() => useDeployment('project-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear the mock calls from initial load
    vi.clearAllMocks();

    await act(async () => {
      await result.current.refreshDeployments();
    });

    expect(mockDeploymentApi.getProjectDeployments).toHaveBeenCalledWith('project-1');
    expect(mockDeploymentApi.getActiveDeployments).toHaveBeenCalledWith('project-1');
  });

  it('should not fetch deployments when projectId is not provided', () => {
    const { result } = renderHook(() => useDeployment());

    expect(result.current.loading).toBe(false);
    expect(result.current.deployments).toEqual([]);
    expect(result.current.activeDeployments).toEqual([]);
    expect(mockDeploymentApi.getProjectDeployments).not.toHaveBeenCalled();
    expect(mockDeploymentApi.getActiveDeployments).not.toHaveBeenCalled();
  });
});