import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { DeploymentRepository } from '../repositories/DeploymentRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import { DeploymentService } from '../services/DeploymentService';
import { prisma } from '../lib/database';
import {
  CreateDeploymentInput,
  UpdateDeploymentInput,
  DeploymentPlatform,
  DeploymentStatus,
  NotFoundError,
  DatabaseError,
} from '../types/database';

const router = express.Router();

// Initialize repositories and service
const deploymentRepository = new DeploymentRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const projectFileRepository = new ProjectFileRepository(prisma);
const deploymentService = new DeploymentService(
  deploymentRepository,
  projectRepository,
  projectFileRepository
);

// Middleware to validate project ownership
const validateProjectOwnership = async (
  req: Request,
  res: Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const projectId = req.params['projectId'] || req.body.projectId;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required'
        }
      });
      return;
    }

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'MISSING_PROJECT_ID',
          message: 'Project ID is required'
        }
      });
      return;
    }

    const belongsToUser = await projectRepository.belongsToUser(projectId, userId);
    if (!belongsToUser) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Project does not belong to user'
        }
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate project ownership'
      }
    });
  }
};

// POST /api/deployments - Create new deployment
router.post('/', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, platform, customDomain, buildCommand, outputDir, envVars } = req.body;

    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Project ID is required and must be a string'
        }
      });
      return;
    }

    if (!platform || !Object.values(DeploymentPlatform).includes(platform)) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Platform is required and must be one of: NETLIFY, VERCEL, GITHUB_PAGES'
        }
      });
      return;
    }

    const deploymentData: CreateDeploymentInput = {
      projectId,
      platform,
      customDomain: customDomain?.trim() || undefined,
      buildCommand: buildCommand?.trim() || undefined,
      outputDir: outputDir?.trim() || undefined,
      envVars: envVars || undefined,
    };

    const deployment = await deploymentService.createDeployment(deploymentData);

    res.status(201).json({
      data: deployment,
      message: 'Deployment created successfully'
    });
  } catch (error: any) {
    console.error('Error creating deployment:', error);

    if (error instanceof DatabaseError) {
      res.status(400).json({
        error: {
          code: error.code || 'DATABASE_ERROR',
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create deployment'
      }
    });
  }
});

// GET /api/deployments/:id - Get deployment details
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const deploymentId = req.params['id'] as string;
    const userId = req.user!.userId;

    const deployment = await deploymentService.getDeployment(deploymentId);

    // Verify user owns the project
    const belongsToUser = await projectRepository.belongsToUser(deployment.projectId, userId);
    if (!belongsToUser) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Deployment does not belong to user'
        }
      });
      return;
    }

    // Check for status updates
    const updatedDeployment = await deploymentService.checkDeploymentStatus(deploymentId);

    res.json({
      data: updatedDeployment
    });
  } catch (error: any) {
    console.error('Error retrieving deployment:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve deployment'
      }
    });
  }
});

// GET /api/deployments/project/:projectId - Get all deployments for a project
router.get('/project/:projectId', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const deployments = await deploymentService.getProjectDeployments(projectId);

    res.json({
      data: deployments
    });
  } catch (error: any) {
    console.error('Error retrieving project deployments:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve project deployments'
      }
    });
  }
});

// GET /api/deployments/project/:projectId/active - Get active deployments for a project
router.get('/project/:projectId/active', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const deployments = await deploymentService.getActiveDeployments(projectId);

    res.json({
      data: deployments
    });
  } catch (error: any) {
    console.error('Error retrieving active deployments:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve active deployments'
      }
    });
  }
});

// PUT /api/deployments/:id - Update deployment
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const deploymentId = req.params['id'] as string;
    const userId = req.user!.userId;
    const { customDomain, buildCommand, outputDir, envVars } = req.body;

    // Get deployment and verify ownership
    const deployment = await deploymentService.getDeployment(deploymentId);
    const belongsToUser = await projectRepository.belongsToUser(deployment.projectId, userId);
    if (!belongsToUser) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Deployment does not belong to user'
        }
      });
      return;
    }

    const updateData: UpdateDeploymentInput = {};

    if (customDomain !== undefined) {
      updateData.customDomain = customDomain?.trim() || undefined;
    }

    if (buildCommand !== undefined) {
      updateData.buildCommand = buildCommand?.trim() || undefined;
    }

    if (outputDir !== undefined) {
      updateData.outputDir = outputDir?.trim() || undefined;
    }

    if (envVars !== undefined) {
      updateData.envVars = envVars;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one field must be provided for update'
        }
      });
      return;
    }

    const updatedDeployment = await deploymentService.updateDeployment(deploymentId, updateData);

    res.json({
      data: updatedDeployment,
      message: 'Deployment updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating deployment:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update deployment'
      }
    });
  }
});

// POST /api/deployments/project/:projectId/redeploy - Redeploy project
router.post('/project/:projectId/redeploy', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const { platform } = req.body;

    if (!platform || !Object.values(DeploymentPlatform).includes(platform)) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Platform is required and must be one of: NETLIFY, VERCEL, GITHUB_PAGES'
        }
      });
      return;
    }

    const deployment = await deploymentService.redeployProject(projectId, platform);

    res.status(201).json({
      data: deployment,
      message: 'Redeployment started successfully'
    });
  } catch (error: any) {
    console.error('Error redeploying project:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to redeploy project'
      }
    });
  }
});

// POST /api/deployments/:id/rollback - Rollback deployment
router.post('/:id/rollback', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const deploymentId = req.params['id'] as string;
    const userId = req.user!.userId;
    const { targetDeploymentId } = req.body;

    if (!targetDeploymentId || typeof targetDeploymentId !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Target deployment ID is required'
        }
      });
      return;
    }

    // Get deployment and verify ownership
    const deployment = await deploymentService.getDeployment(deploymentId);
    const belongsToUser = await projectRepository.belongsToUser(deployment.projectId, userId);
    if (!belongsToUser) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Deployment does not belong to user'
        }
      });
      return;
    }

    const rolledBackDeployment = await deploymentService.rollbackDeployment(deploymentId, targetDeploymentId);

    res.json({
      data: rolledBackDeployment,
      message: 'Rollback completed successfully'
    });
  } catch (error: any) {
    console.error('Error rolling back deployment:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to rollback deployment'
      }
    });
  }
});

// DELETE /api/deployments/:id - Delete deployment
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const deploymentId = req.params['id'] as string;
    const userId = req.user!.userId;

    // Get deployment and verify ownership
    const deployment = await deploymentService.getDeployment(deploymentId);
    const belongsToUser = await projectRepository.belongsToUser(deployment.projectId, userId);
    if (!belongsToUser) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Deployment does not belong to user'
        }
      });
      return;
    }

    const deletedDeployment = await deploymentService.deleteDeployment(deploymentId);

    res.json({
      data: deletedDeployment,
      message: 'Deployment deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting deployment:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete deployment'
      }
    });
  }
});

export default router;