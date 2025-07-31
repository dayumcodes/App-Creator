import request from 'supertest';
import express from 'express';
import deploymentRoutes from '../../routes/deployments';
import { authenticateToken } from '../../middleware/auth';
import { DeploymentPlatform, DeploymentStatus } from '../../types/database';

// Mock the middleware
jest.mock('../../middleware/auth');

// Mock the services and repositories
jest.mock('../../repositories/DeploymentRepository');
jest.mock('../../repositories/ProjectRepository');
jest.mock('../../repositories/ProjectFileRepository');
jest.mock('../../services/DeploymentService');

const app = express();
app.use(express.json());
app.use('/api/deployments', deploymentRoutes);

const mockUser = {
  userId: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
};

const mockDeployment = {
  id: 'deployment-1',
  projectId: 'project-1',
  platform: DeploymentPlatform.NETLIFY,
  status: DeploymentStatus.PENDING,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Deployment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });
  });

  describe('POST /api/deployments', () => {
    it('should create a new deployment', async () => {
      const deploymentData = {
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
        customDomain: 'example.com',
      };

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.createDeployment = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/deployments')
        .send(deploymentData)
        .expect(201);

      expect(response.body.data).toEqual(mockDeployment);
      expect(response.body.message).toBe('Deployment created successfully');
    });

    it('should return 400 for invalid platform', async () => {
      const deploymentData = {
        projectId: 'project-1',
        platform: 'INVALID_PLATFORM',
      };

      const response = await request(app)
        .post('/api/deployments')
        .send(deploymentData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Platform is required');
    });

    it('should return 400 for missing project ID', async () => {
      const deploymentData = {
        platform: DeploymentPlatform.NETLIFY,
      };

      const response = await request(app)
        .post('/api/deployments')
        .send(deploymentData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Project ID is required');
    });

    it('should return 403 for unauthorized project access', async () => {
      const deploymentData = {
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
      };

      // Mock project ownership validation to return false
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/deployments')
        .send(deploymentData)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/deployments/:id', () => {
    it('should get deployment by ID', async () => {
      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);
      mockDeploymentService.prototype.checkDeploymentStatus = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .get('/api/deployments/deployment-1')
        .expect(200);

      expect(response.body.data).toEqual(mockDeployment);
    });

    it('should return 404 for non-existent deployment', async () => {
      // Mock the deployment service to throw NotFoundError
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      const { NotFoundError } = require('../../types/database');
      mockDeploymentService.prototype.getDeployment = jest.fn().mockRejectedValue(
        new NotFoundError('Deployment', 'nonexistent-id')
      );

      const response = await request(app)
        .get('/api/deployments/nonexistent-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation to return false
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .get('/api/deployments/deployment-1')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/deployments/project/:projectId', () => {
    it('should get all deployments for a project', async () => {
      const deployments = [mockDeployment];

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getProjectDeployments = jest.fn().mockResolvedValue(deployments);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .get('/api/deployments/project/project-1')
        .expect(200);

      expect(response.body.data).toEqual(deployments);
    });
  });

  describe('GET /api/deployments/project/:projectId/active', () => {
    it('should get active deployments for a project', async () => {
      const activeDeployments = [
        { ...mockDeployment, status: DeploymentStatus.SUCCESS }
      ];

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getActiveDeployments = jest.fn().mockResolvedValue(activeDeployments);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .get('/api/deployments/project/project-1/active')
        .expect(200);

      expect(response.body.data).toEqual(activeDeployments);
    });
  });

  describe('PUT /api/deployments/:id', () => {
    it('should update deployment', async () => {
      const updateData = {
        customDomain: 'newdomain.com',
      };

      const updatedDeployment = { ...mockDeployment, ...updateData };

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);
      mockDeploymentService.prototype.updateDeployment = jest.fn().mockResolvedValue(updatedDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .put('/api/deployments/deployment-1')
        .send(updateData)
        .expect(200);

      expect(response.body.data).toEqual(updatedDeployment);
      expect(response.body.message).toBe('Deployment updated successfully');
    });

    it('should return 400 for empty update data', async () => {
      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .put('/api/deployments/deployment-1')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('At least one field must be provided');
    });
  });

  describe('POST /api/deployments/project/:projectId/redeploy', () => {
    it('should redeploy project', async () => {
      const redeployData = {
        platform: DeploymentPlatform.NETLIFY,
      };

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.redeployProject = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/deployments/project/project-1/redeploy')
        .send(redeployData)
        .expect(201);

      expect(response.body.data).toEqual(mockDeployment);
      expect(response.body.message).toBe('Redeployment started successfully');
    });

    it('should return 400 for invalid platform', async () => {
      const redeployData = {
        platform: 'INVALID_PLATFORM',
      };

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/deployments/project/project-1/redeploy')
        .send(redeployData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Platform is required');
    });
  });

  describe('POST /api/deployments/:id/rollback', () => {
    it('should rollback deployment', async () => {
      const rollbackData = {
        targetDeploymentId: 'target-deployment-1',
      };

      const rolledBackDeployment = { ...mockDeployment, status: DeploymentStatus.BUILDING };

      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);
      mockDeploymentService.prototype.rollbackDeployment = jest.fn().mockResolvedValue(rolledBackDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/deployments/deployment-1/rollback')
        .send(rollbackData)
        .expect(200);

      expect(response.body.data).toEqual(rolledBackDeployment);
      expect(response.body.message).toBe('Rollback completed successfully');
    });

    it('should return 400 for missing target deployment ID', async () => {
      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/deployments/deployment-1/rollback')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Target deployment ID is required');
    });
  });

  describe('DELETE /api/deployments/:id', () => {
    it('should delete deployment', async () => {
      // Mock the deployment service
      const mockDeploymentService = require('../../services/DeploymentService').DeploymentService;
      mockDeploymentService.prototype.getDeployment = jest.fn().mockResolvedValue(mockDeployment);
      mockDeploymentService.prototype.deleteDeployment = jest.fn().mockResolvedValue(mockDeployment);

      // Mock project ownership validation
      const mockProjectRepository = require('../../repositories/ProjectRepository').ProjectRepository;
      mockProjectRepository.prototype.belongsToUser = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/deployments/deployment-1')
        .expect(200);

      expect(response.body.data).toEqual(mockDeployment);
      expect(response.body.message).toBe('Deployment deleted successfully');
    });
  });
});