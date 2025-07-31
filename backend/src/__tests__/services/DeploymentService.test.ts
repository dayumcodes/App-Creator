import { DeploymentService } from '../../services/DeploymentService';
import { DeploymentRepository } from '../../repositories/DeploymentRepository';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';
import {
  DeploymentPlatform,
  DeploymentStatus,
  CreateDeploymentInput,
  UpdateDeploymentInput,
} from '../../types/database';

// Mock the repositories
jest.mock('../../repositories/DeploymentRepository');
jest.mock('../../repositories/ProjectRepository');
jest.mock('../../repositories/ProjectFileRepository');

// Mock the deployment providers
jest.mock('../../services/deployment/NetlifyDeploymentProvider');
jest.mock('../../services/deployment/VercelDeploymentProvider');
jest.mock('../../services/deployment/GitHubPagesDeploymentProvider');

describe('DeploymentService', () => {
  let deploymentService: DeploymentService;
  let mockDeploymentRepo: jest.Mocked<DeploymentRepository>;
  let mockProjectRepo: jest.Mocked<ProjectRepository>;
  let mockProjectFileRepo: jest.Mocked<ProjectFileRepository>;

  const mockProject = {
    id: 'project-1',
    userId: 'user-1',
    name: 'Test Project',
    description: 'Test Description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFiles = [
    {
      id: 'file-1',
      projectId: 'project-1',
      filename: 'index.html',
      content: '<html><body>Hello World</body></html>',
      type: 'HTML' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'file-2',
      projectId: 'project-1',
      filename: 'style.css',
      content: 'body { margin: 0; }',
      type: 'CSS' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockDeployment = {
    id: 'deployment-1',
    projectId: 'project-1',
    platform: DeploymentPlatform.NETLIFY,
    status: DeploymentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDeploymentRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdOrThrow: jest.fn(),
      findByProject: jest.fn(),
      findByProjectAndPlatform: jest.fn(),
      findLatestByProjectAndPlatform: jest.fn(),
      findActiveDeployments: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    mockProjectRepo = {
      findByIdOrThrow: jest.fn(),
      belongsToUser: jest.fn(),
    } as any;
    
    mockProjectFileRepo = {
      findByProject: jest.fn(),
    } as any;

    deploymentService = new DeploymentService(
      mockDeploymentRepo,
      mockProjectRepo,
      mockProjectFileRepo
    );
  });

  describe('createDeployment', () => {
    it('should create a deployment successfully', async () => {
      const deploymentData: CreateDeploymentInput = {
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
      };

      mockProjectRepo.findByIdOrThrow.mockResolvedValue(mockProject);
      mockProjectFileRepo.findByProject.mockResolvedValue(mockFiles);
      mockDeploymentRepo.create.mockResolvedValue(mockDeployment);

      const result = await deploymentService.createDeployment(deploymentData);

      expect(mockProjectRepo.findByIdOrThrow).toHaveBeenCalledWith('project-1');
      expect(mockProjectFileRepo.findByProject).toHaveBeenCalledWith('project-1');
      expect(mockDeploymentRepo.create).toHaveBeenCalledWith(deploymentData);
      expect(result).toEqual(mockDeployment);
    });

    it('should throw error if project has no files', async () => {
      const deploymentData: CreateDeploymentInput = {
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
      };

      mockProjectRepo.findByIdOrThrow.mockResolvedValue(mockProject);
      mockProjectFileRepo.findByProject.mockResolvedValue([]);

      await expect(deploymentService.createDeployment(deploymentData)).rejects.toThrow(
        'Cannot deploy project with no files'
      );
    });

    it('should throw error if project does not exist', async () => {
      const deploymentData: CreateDeploymentInput = {
        projectId: 'nonexistent-project',
        platform: DeploymentPlatform.NETLIFY,
      };

      mockProjectRepo.findByIdOrThrow.mockRejectedValue(new Error('Project not found'));

      await expect(deploymentService.createDeployment(deploymentData)).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('getDeployment', () => {
    it('should get deployment by id', async () => {
      mockDeploymentRepo.findByIdOrThrow.mockResolvedValue(mockDeployment);

      const result = await deploymentService.getDeployment('deployment-1');

      expect(mockDeploymentRepo.findByIdOrThrow).toHaveBeenCalledWith('deployment-1');
      expect(result).toEqual(mockDeployment);
    });
  });

  describe('getProjectDeployments', () => {
    it('should get all deployments for a project', async () => {
      const deployments = [mockDeployment];
      mockDeploymentRepo.findByProject.mockResolvedValue(deployments);

      const result = await deploymentService.getProjectDeployments('project-1');

      expect(mockDeploymentRepo.findByProject).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(deployments);
    });
  });

  describe('getActiveDeployments', () => {
    it('should get active deployments for a project', async () => {
      const activeDeployments = [
        { ...mockDeployment, status: DeploymentStatus.SUCCESS },
      ];
      mockDeploymentRepo.findActiveDeployments.mockResolvedValue(activeDeployments);

      const result = await deploymentService.getActiveDeployments('project-1');

      expect(mockDeploymentRepo.findActiveDeployments).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(activeDeployments);
    });
  });

  describe('updateDeployment', () => {
    it('should update deployment successfully', async () => {
      const updateData: UpdateDeploymentInput = {
        status: DeploymentStatus.SUCCESS,
        url: 'https://example.netlify.app',
      };

      const updatedDeployment = { 
        ...mockDeployment, 
        status: DeploymentStatus.SUCCESS,
        url: 'https://example.netlify.app',
      };

      mockDeploymentRepo.findByIdOrThrow.mockResolvedValue(mockDeployment);
      mockDeploymentRepo.update.mockResolvedValue(updatedDeployment);

      const result = await deploymentService.updateDeployment('deployment-1', updateData);

      expect(mockDeploymentRepo.findByIdOrThrow).toHaveBeenCalledWith('deployment-1');
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith('deployment-1', updateData);
      expect(result).toEqual(updatedDeployment);
    });
  });

  describe('redeployProject', () => {
    it('should redeploy project with latest configuration', async () => {
      const latestDeployment = {
        ...mockDeployment,
        customDomain: 'example.com',
        buildCommand: 'npm run build',
      };

      mockDeploymentRepo.findLatestByProjectAndPlatform.mockResolvedValue(latestDeployment);
      mockProjectRepo.findByIdOrThrow.mockResolvedValue(mockProject);
      mockProjectFileRepo.findByProject.mockResolvedValue(mockFiles);
      mockDeploymentRepo.create.mockResolvedValue(mockDeployment);

      const result = await deploymentService.redeployProject('project-1', DeploymentPlatform.NETLIFY);

      expect(mockDeploymentRepo.findLatestByProjectAndPlatform).toHaveBeenCalledWith(
        'project-1',
        DeploymentPlatform.NETLIFY
      );
      expect(mockDeploymentRepo.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
        customDomain: 'example.com',
        buildCommand: 'npm run build',
        outputDir: undefined,
        envVars: undefined,
      });
      expect(result).toEqual(mockDeployment);
    });

    it('should redeploy project without previous configuration', async () => {
      mockDeploymentRepo.findLatestByProjectAndPlatform.mockResolvedValue(null);
      mockProjectRepo.findByIdOrThrow.mockResolvedValue(mockProject);
      mockProjectFileRepo.findByProject.mockResolvedValue(mockFiles);
      mockDeploymentRepo.create.mockResolvedValue(mockDeployment);

      const result = await deploymentService.redeployProject('project-1', DeploymentPlatform.NETLIFY);

      expect(mockDeploymentRepo.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
        customDomain: undefined,
        buildCommand: undefined,
        outputDir: undefined,
        envVars: undefined,
      });
      expect(result).toEqual(mockDeployment);
    });
  });

  describe('deleteDeployment', () => {
    it('should delete deployment successfully', async () => {
      mockDeploymentRepo.findByIdOrThrow.mockResolvedValue(mockDeployment);
      mockDeploymentRepo.delete.mockResolvedValue(mockDeployment);

      const result = await deploymentService.deleteDeployment('deployment-1');

      expect(mockDeploymentRepo.findByIdOrThrow).toHaveBeenCalledWith('deployment-1');
      expect(mockDeploymentRepo.delete).toHaveBeenCalledWith('deployment-1');
      expect(result).toEqual(mockDeployment);
    });
  });

  describe('checkDeploymentStatus', () => {
    it('should return deployment without checking if already completed', async () => {
      const completedDeployment = {
        ...mockDeployment,
        status: DeploymentStatus.SUCCESS,
        deploymentId: 'netlify-123',
      };

      mockDeploymentRepo.findByIdOrThrow.mockResolvedValue(completedDeployment);

      const result = await deploymentService.checkDeploymentStatus('deployment-1');

      expect(mockDeploymentRepo.findByIdOrThrow).toHaveBeenCalledWith('deployment-1');
      expect(result).toEqual(completedDeployment);
    });

    it('should return deployment without checking if no deploymentId', async () => {
      const deploymentWithoutId = {
        ...mockDeployment,
        status: DeploymentStatus.BUILDING,
      };

      mockDeploymentRepo.findByIdOrThrow.mockResolvedValue(deploymentWithoutId);

      const result = await deploymentService.checkDeploymentStatus('deployment-1');

      expect(result).toEqual(deploymentWithoutId);
    });
  });
});