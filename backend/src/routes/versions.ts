import { Router, Request, Response } from 'express';
import { VersionControlService } from '../services/VersionControlService';
import { ProjectVersionRepository } from '../repositories/ProjectVersionRepository';
import { FileSnapshotRepository } from '../repositories/FileSnapshotRepository';
import { FileChangeRepository } from '../repositories/FileChangeRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { authMiddleware } from '../middleware/auth';
import { NotFoundError } from '../types/database';

const router = Router();

// Initialize repositories and service
const projectVersionRepo = new ProjectVersionRepository();
const fileSnapshotRepo = new FileSnapshotRepository();
const fileChangeRepo = new FileChangeRepository();
const projectFileRepo = new ProjectFileRepository();
const projectRepo = new ProjectRepository();

const versionControlService = new VersionControlService(
  projectVersionRepo,
  fileSnapshotRepo,
  fileChangeRepo,
  projectFileRepo
);

// Middleware to verify project ownership
const verifyProjectOwnership = async (req: Request, res: Response, next: any) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  } catch (error) {
    console.error('Error verifying project ownership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new version
router.post('/:projectId/versions', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Version name is required' });
    }

    const version = await versionControlService.createVersion(projectId, name, description);
    res.json(version);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// Get version history for a project
router.get('/:projectId/versions', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const versions = await versionControlService.getVersionHistory(projectId);
    res.json(versions);
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({ error: 'Failed to get version history' });
  }
});

// Get a specific version with files
router.get('/:projectId/versions/:versionId', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    const version = await versionControlService.getVersionWithFiles(versionId);
    res.json(version);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error getting version:', error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// Rollback to a specific version
router.post('/:projectId/versions/:versionId/rollback', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    await versionControlService.rollbackToVersion(versionId);
    res.json({ message: 'Successfully rolled back to version' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error rolling back version:', error);
    res.status(500).json({ error: 'Failed to rollback version' });
  }
});

// Delete a version
router.delete('/:projectId/versions/:versionId', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    await versionControlService.deleteVersion(versionId);
    res.json({ message: 'Version deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error deleting version:', error);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// Get change history for a project
router.get('/:projectId/changes', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { limit, offset } = req.query;
    
    const changes = await versionControlService.getChangeHistory(
      projectId,
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );
    
    res.json(changes);
  } catch (error) {
    console.error('Error getting change history:', error);
    res.status(500).json({ error: 'Failed to get change history' });
  }
});

// Get change history for a specific file
router.get('/:projectId/changes/:filename', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId, filename } = req.params;
    const { limit, offset } = req.query;
    
    const changes = await versionControlService.getFileChangeHistory(
      projectId,
      decodeURIComponent(filename),
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );
    
    res.json(changes);
  } catch (error) {
    console.error('Error getting file change history:', error);
    res.status(500).json({ error: 'Failed to get file change history' });
  }
});

// Undo last change
router.post('/:projectId/undo', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const success = await versionControlService.undoLastChange(projectId);
    
    if (success) {
      res.json({ message: 'Successfully undid last change' });
    } else {
      res.status(400).json({ error: 'No changes to undo' });
    }
  } catch (error) {
    console.error('Error undoing change:', error);
    res.status(500).json({ error: 'Failed to undo change' });
  }
});

// Get undo/redo state
router.get('/:projectId/undo-state', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const state = await versionControlService.getUndoRedoState(projectId);
    res.json(state);
  } catch (error) {
    console.error('Error getting undo state:', error);
    res.status(500).json({ error: 'Failed to get undo state' });
  }
});

// Compare two versions
router.get('/:projectId/compare/:versionId1/:versionId2', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { versionId1, versionId2 } = req.params;
    const diffs = await versionControlService.compareVersions(versionId1, versionId2);
    res.json(diffs);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error comparing versions:', error);
    res.status(500).json({ error: 'Failed to compare versions' });
  }
});

// Compare version with current state
router.get('/:projectId/compare/:versionId/current', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    const diffs = await versionControlService.compareWithCurrentState(versionId);
    res.json(diffs);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error comparing with current state:', error);
    res.status(500).json({ error: 'Failed to compare with current state' });
  }
});

// Create experimental branch
router.post('/:projectId/branch', authMiddleware, verifyProjectOwnership, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { baseName, description } = req.body;

    if (!baseName) {
      return res.status(400).json({ error: 'Base name is required' });
    }

    const branch = await versionControlService.createExperimentalBranch(projectId, baseName, description);
    res.json(branch);
  } catch (error) {
    console.error('Error creating experimental branch:', error);
    res.status(500).json({ error: 'Failed to create experimental branch' });
  }
});

export default router;