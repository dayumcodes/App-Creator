import { Router, Request, Response } from 'express';
import { CodeGenerationService } from '../services/CodeGenerationService';
import { authenticateToken } from '../middleware/auth';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Generate code from natural language prompt
 * POST /api/generate
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, projectId } = req.body;
    const userId = req.user?.userId;

    // Create service instances
    const codeGenerationService = new CodeGenerationService();
    const projectRepository = new ProjectRepository();
    const projectFileRepository = new ProjectFileRepository();

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_PROMPT',
          message: 'Prompt is required and must be a string'
        }
      });
      return;
    }

    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_PROJECT_ID',
          message: 'Project ID is required and must be a string'
        }
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required'
        }
      });
      return;
    }

    // Verify project ownership
    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
      return;
    }

    if (project.userId !== userId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this project'
        }
      });
      return;
    }

    // Generate code
    const result = await codeGenerationService.generateApplication(prompt, projectId, userId);

    // Save generated files to the project
    for (const file of result.files) {
      await projectFileRepository.createOrUpdate({
        projectId,
        filename: file.filename,
        content: file.content,
        type: file.type
      });
    }

    res.json({
      success: true,
      data: {
        files: result.files,
        isValid: result.isValid,
        validationErrors: result.validationErrors
      }
    });

  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({
      error: {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Code generation failed'
      }
    });
  }
});

/**
 * Iterate on existing code with additional prompts
 * POST /api/generate/iterate
 */
router.post('/iterate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, projectId } = req.body;
    const userId = req.user?.userId;

    // Create service instances
    const codeGenerationService = new CodeGenerationService();
    const projectRepository = new ProjectRepository();
    const projectFileRepository = new ProjectFileRepository();

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_PROMPT',
          message: 'Prompt is required and must be a string'
        }
      });
      return;
    }

    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_PROJECT_ID',
          message: 'Project ID is required and must be a string'
        }
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required'
        }
      });
      return;
    }

    // Verify project ownership
    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        }
      });
      return;
    }

    if (project.userId !== userId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this project'
        }
      });
      return;
    }

    // Iterate on existing code
    const result = await codeGenerationService.iterateOnCode(prompt, projectId, userId);

    // Update modified files in the project
    for (const file of result.modifiedFiles) {
      await projectFileRepository.createOrUpdate({
        projectId,
        filename: file.filename,
        content: file.content,
        type: file.type
      });
    }

    res.json({
      success: true,
      data: {
        modifiedFiles: result.modifiedFiles,
        isValid: result.isValid,
        validationErrors: result.validationErrors
      }
    });

  } catch (error) {
    console.error('Code iteration error:', error);
    res.status(500).json({
      error: {
        code: 'ITERATION_FAILED',
        message: error instanceof Error ? error.message : 'Code iteration failed'
      }
    });
  }
});

/**
 * Validate code without generating
 * POST /api/generate/validate
 */
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { files } = req.body;
    const userId = req.user?.userId;

    if (!files || !Array.isArray(files)) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILES',
          message: 'Files array is required'
        }
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required'
        }
      });
      return;
    }

    // Validate the provided files
    const validationService = new (await import('../services/CodeValidationService')).CodeValidationService();
    const result = await validationService.validateFiles(files);

    res.json({
      success: true,
      data: {
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings
      }
    });

  } catch (error) {
    console.error('Code validation error:', error);
    res.status(500).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: error instanceof Error ? error.message : 'Code validation failed'
      }
    });
  }
});

export default router;