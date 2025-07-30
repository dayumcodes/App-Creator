import express, { Request, Response } from 'express';
import archiver from 'archiver';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectFileRepository } from '../repositories/ProjectFileRepository';
import {
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectFileInput,
  UpdateProjectFileInput,
  NotFoundError,
  DatabaseError,
} from '../types/database';

const router = express.Router();
const projectRepository = new ProjectRepository();
const projectFileRepository = new ProjectFileRepository();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

// Middleware to validate project ownership
const validateProjectOwnership = async (
  req: Request,
  res: Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const projectId = req.params['id'] || req.params['projectId'];
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

    // First check if project exists
    const projectExists = await projectRepository.exists(projectId);
    if (!projectExists) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
      return;
    }

    // Then check ownership
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

// GET /api/projects - List user projects with pagination and filtering
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 10, 50); // Max 50 items per page
    const search = req.query['search'] as string;

    const result = await projectRepository.findByUser({
      userId,
      page,
      limit,
      search,
    });

    res.json({
      data: result.projects,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve projects'
      }
    });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Project name is required and must be a non-empty string'
        }
      });
      return;
    }

    const projectData: CreateProjectInput = {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
    };

    const project = await projectRepository.create(projectData);

    res.status(201).json({
      data: project,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);

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
        message: 'Failed to create project'
      }
    });
  }
});

// GET /api/projects/:id - Get project details with files
router.get('/:id', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['id'] as string;
    const includeFiles = req.query['includeFiles'] !== 'false';

    let project;
    if (includeFiles) {
      project = await projectRepository.findWithFiles(projectId);
    } else {
      project = await projectRepository.findById(projectId);
    }

    if (!project) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
      return;
    }

    res.json({
      data: project
    });
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve project'
      }
    });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['id'] as string;
    const { name, description } = req.body;

    const updateData: UpdateProjectInput = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Project name must be a non-empty string'
          }
        });
        return;
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
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

    const project = await projectRepository.update(projectId, updateData);

    res.json({
      data: project,
      message: 'Project updated successfully'
    });
  } catch (error) {
    console.error('Error updating project:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

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
        message: 'Failed to update project'
      }
    });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['id'] as string;

    const project = await projectRepository.delete(projectId);

    res.json({
      data: project,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);

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
        message: 'Failed to delete project'
      }
    });
  }
});

// GET /api/projects/:projectId/files - Get all files for a project
router.get('/:projectId/files', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const files = await projectFileRepository.findByProject(projectId);

    res.json({
      data: files
    });
  } catch (error) {
    console.error('Error retrieving project files:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve project files'
      }
    });
  }
});

// GET /api/projects/:projectId/files/:filename - Get specific file
router.get('/:projectId/files/:filename', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, filename } = req.params as { projectId: string; filename: string };
    const file = await projectFileRepository.findByProjectAndFilename(projectId, filename);

    if (!file) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'File not found'
        }
      });
      return;
    }

    res.json({
      data: file
    });
  } catch (error) {
    console.error('Error retrieving project file:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve project file'
      }
    });
  }
});

// POST /api/projects/:projectId/files - Create new file
router.post('/:projectId/files', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const { filename, content, type } = req.body;

    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Filename is required and must be a non-empty string'
        }
      });
      return;
    }

    if (!content || typeof content !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Content is required and must be a string'
        }
      });
      return;
    }

    if (!type || !['HTML', 'CSS', 'JS', 'JSON'].includes(type)) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Type is required and must be one of: HTML, CSS, JS, JSON'
        }
      });
      return;
    }

    const fileData: CreateProjectFileInput = {
      projectId,
      filename: filename.trim(),
      content,
      type,
    };

    const file = await projectFileRepository.create(fileData);

    res.status(201).json({
      data: file,
      message: 'File created successfully'
    });
  } catch (error) {
    console.error('Error creating project file:', error);

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
        message: 'Failed to create project file'
      }
    });
  }
});

// PUT /api/projects/:projectId/files/:filename - Update file content
router.put('/:projectId/files/:filename', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, filename } = req.params as { projectId: string; filename: string };
    const { content, type } = req.body;

    const updateData: Omit<UpdateProjectFileInput, 'filename'> = {};

    if (content !== undefined) {
      if (typeof content !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Content must be a string'
          }
        });
        return;
      }
      updateData.content = content;
    }

    if (type !== undefined) {
      if (!['HTML', 'CSS', 'JS', 'JSON'].includes(type)) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Type must be one of: HTML, CSS, JS, JSON'
          }
        });
        return;
      }
      updateData.type = type;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one field (content or type) must be provided for update'
        }
      });
      return;
    }

    const file = await projectFileRepository.updateByProjectAndFilename(
      projectId,
      filename,
      updateData
    );

    res.json({
      data: file,
      message: 'File updated successfully'
    });
  } catch (error) {
    console.error('Error updating project file:', error);

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
      return;
    }

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
        message: 'Failed to update project file'
      }
    });
  }
});

// PUT /api/projects/:projectId/files - Create or update multiple files
router.put('/:projectId/files', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['projectId'] as string;
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Files array is required and must not be empty'
        }
      });
      return;
    }

    // Validate all files first
    for (const file of files) {
      if (!file.filename || typeof file.filename !== 'string' || file.filename.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Each file must have a valid filename'
          }
        });
        return;
      }

      if (!file.content || typeof file.content !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Each file must have valid content'
          }
        });
        return;
      }

      if (!file.type || !['HTML', 'CSS', 'JS', 'JSON'].includes(file.type)) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Each file must have a valid type (HTML, CSS, JS, JSON)'
          }
        });
        return;
      }
    }

    // Create or update all files
    const updatedFiles = [];
    for (const file of files) {
      const fileData: CreateProjectFileInput = {
        projectId,
        filename: file.filename.trim(),
        content: file.content,
        type: file.type,
      };

      const updatedFile = await projectFileRepository.createOrUpdate(fileData);
      updatedFiles.push(updatedFile);
    }

    res.json({
      data: updatedFiles,
      message: 'Files updated successfully'
    });
  } catch (error) {
    console.error('Error updating project files:', error);

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
        message: 'Failed to update project files'
      }
    });
  }
});

// DELETE /api/projects/:projectId/files/:filename - Delete file
router.delete('/:projectId/files/:filename', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, filename } = req.params as { projectId: string; filename: string };

    const file = await projectFileRepository.deleteByProjectAndFilename(projectId, filename);

    res.json({
      data: file,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project file:', error);

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
        message: 'Failed to delete project file'
      }
    });
  }
});

// POST /api/projects/import - Import project from ZIP
router.post('/import', authenticateToken, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, description } = req.body;

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'ZIP file is required'
        }
      });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Project name is required'
        }
      });
      return;
    }

    try {
      // Parse ZIP file
      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();

      if (zipEntries.length === 0) {
        res.status(400).json({
          error: {
            code: 'EMPTY_ZIP',
            message: 'ZIP file is empty'
          }
        });
        return;
      }

      // Filter and validate files
      const validFiles: Array<{ filename: string; content: string; type: 'HTML' | 'CSS' | 'JS' | 'JSON' }> = [];
      const allowedExtensions = ['.html', '.css', '.js', '.json'];

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const filename = entry.entryName;
        const ext = path.extname(filename).toLowerCase();

        if (!allowedExtensions.includes(ext)) continue;

        // Skip system files and hidden files
        if (filename.startsWith('.') || filename.includes('__MACOSX')) continue;

        const content = entry.getData().toString('utf8');
        if (content.length === 0) continue;

        let type: 'HTML' | 'CSS' | 'JS' | 'JSON';
        switch (ext) {
          case '.html':
            type = 'HTML';
            break;
          case '.css':
            type = 'CSS';
            break;
          case '.js':
            type = 'JS';
            break;
          case '.json':
            type = 'JSON';
            break;
          default:
            continue;
        }

        validFiles.push({
          filename: path.basename(filename),
          content,
          type,
        });
      }

      if (validFiles.length === 0) {
        res.status(400).json({
          error: {
            code: 'NO_VALID_FILES',
            message: 'ZIP file contains no valid web files (HTML, CSS, JS, JSON)'
          }
        });
        return;
      }

      // Create project
      const projectData: CreateProjectInput = {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
      };

      const project = await projectRepository.create(projectData);

      // Create files
      const createdFiles = [];
      for (const file of validFiles) {
        const fileData: CreateProjectFileInput = {
          projectId: project.id,
          filename: file.filename,
          content: file.content,
          type: file.type,
        };

        const createdFile = await projectFileRepository.create(fileData);
        createdFiles.push(createdFile);
      }

      // Return project with files
      const projectWithFiles = await projectRepository.findWithFiles(project.id);

      res.status(201).json({
        data: projectWithFiles,
        message: `Project imported successfully with ${createdFiles.length} files`
      });

    } catch (zipError) {
      console.error('Error parsing ZIP file:', zipError);
      res.status(400).json({
        error: {
          code: 'INVALID_ZIP',
          message: 'Invalid or corrupted ZIP file'
        }
      });
      return;
    }

  } catch (error) {
    console.error('Error importing project:', error);

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
        message: 'Failed to import project'
      }
    });
  }
});

// POST /api/projects/:id/export - Export project as ZIP
router.post('/:id/export', authenticateToken, validateProjectOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params['id'] as string;

    // Get project with files
    const project = await projectRepository.findWithFiles(projectId);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
      return;
    }

    if (project.files.length === 0) {
      res.status(400).json({
        error: {
          code: 'NO_FILES',
          message: 'Project has no files to export'
        }
      });
      return;
    }

    // Set response headers for ZIP download
    const zipFilename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'ARCHIVE_ERROR',
            message: 'Failed to create ZIP archive'
          }
        });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    for (const file of project.files) {
      archive.append(file.content, { name: file.filename });
    }

    // Add a README with project information
    const readmeContent = `# ${project.name}

${project.description || 'No description provided'}

## Project Information
- Created: ${project.createdAt.toISOString()}
- Last Updated: ${project.updatedAt.toISOString()}
- Files: ${project.files.length}

## Files Included
${project.files.map(f => `- ${f.filename} (${f.type})`).join('\n')}

Generated by Lovable Clone on ${new Date().toISOString()}
`;

    archive.append(readmeContent, { name: 'README.md' });

    // Finalize the archive
    await archive.finalize();

  } catch (error) {
    console.error('Error exporting project:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export project'
        }
      });
    }
  }
});

export default router;