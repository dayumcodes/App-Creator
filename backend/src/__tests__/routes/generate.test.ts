import request from 'supertest';
import express from 'express';
import generateRoutes from '../../routes/generate';
import { CodeGenerationService } from '../../services/CodeGenerationService';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';

// Mock dependencies
jest.mock('../../services/CodeGenerationService');
jest.mock('../../repositories/ProjectRepository');
jest.mock('../../repositories/ProjectFileRepository');
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1' };
    next();
  }
}));

describe('Generate Routes', () => {
  let app: express.Application;
  let mockCodeGenerationService: jest.Mocked<CodeGenerationService>;
  let mockProjectRepository: jest.Mocked<ProjectRepository>;
  let mockProjectFileRepository: jest.Mocked<ProjectFileRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/generate', generateRoutes);

    // Create mocked instances
    mockCodeGenerationService = new CodeGenerationService() as jest.Mocked<CodeGenerationService>;
    mockProjectRepository = new ProjectRepository() as jest.Mocked<ProjectRepository>;
    mockProjectFileRepository = new ProjectFileRepository() as jest.Mocked<ProjectFileRepository>;

    // Mock constructors
    (CodeGenerationService as jest.MockedClass<typeof CodeGenerationService>).mockImplementation(() => mockCodeGenerationService);
    (ProjectRepository as jest.MockedClass<typeof ProjectRepository>).mockImplementation(() => mockProjectRepository);
    (ProjectFileRepository as jest.MockedClass<typeof ProjectFileRepository>).mockImplementation(() => mockProjectFileRepository);
  });

  describe('POST /api/generate', () => {
    it('should generate code successfully', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockGenerationResult = {
        files: [
          {
            filename: 'index.html',
            content: '<html><body>Hello World</body></html>',
            type: 'html' as const
          }
        ],
        isValid: true,
        validationErrors: []
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockCodeGenerationService.generateApplication.mockResolvedValue(mockGenerationResult);
      mockProjectFileRepository.upsert.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        filename: 'index.html',
        content: '<html><body>Hello World</body></html>',
        type: 'html',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/api/generate')
        .send({
          prompt: 'Create a hello world page',
          projectId: 'project-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(1);
      expect(response.body.data.isValid).toBe(true);

      expect(mockCodeGenerationService.generateApplication).toHaveBeenCalledWith(
        'Create a hello world page',
        'project-1',
        'user-1'
      );
      expect(mockProjectFileRepository.upsert).toHaveBeenCalledWith({
        projectId: 'project-1',
        filename: 'index.html',
        content: '<html><body>Hello World</body></html>',
        type: 'html'
      });
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({
          projectId: 'project-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PROMPT');
    });

    it('should return 400 for missing projectId', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({
          prompt: 'Create a page'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PROJECT_ID');
    });

    it('should return 404 for non-existent project', async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/generate')
        .send({
          prompt: 'Create a page',
          projectId: 'non-existent'
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should return 403 for unauthorized project access', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'other-user',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/generate')
        .send({
          prompt: 'Create a page',
          projectId: 'project-1'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should handle generation service errors', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockCodeGenerationService.generateApplication.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .post('/api/generate')
        .send({
          prompt: 'Create a page',
          projectId: 'project-1'
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('GENERATION_FAILED');
      expect(response.body.error.message).toBe('Generation failed');
    });
  });

  describe('POST /api/generate/iterate', () => {
    it('should iterate on code successfully', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockIterationResult = {
        modifiedFiles: [
          {
            filename: 'index.html',
            content: '<html><body><h1>Modified</h1></body></html>',
            type: 'html' as const
          }
        ],
        isValid: true,
        validationErrors: []
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockCodeGenerationService.iterateOnCode.mockResolvedValue(mockIterationResult);
      mockProjectFileRepository.upsert.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        filename: 'index.html',
        content: '<html><body><h1>Modified</h1></body></html>',
        type: 'html',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/api/generate/iterate')
        .send({
          prompt: 'Add a heading',
          projectId: 'project-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.modifiedFiles).toHaveLength(1);
      expect(response.body.data.isValid).toBe(true);

      expect(mockCodeGenerationService.iterateOnCode).toHaveBeenCalledWith(
        'Add a heading',
        'project-1',
        'user-1'
      );
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/generate/iterate')
        .send({
          projectId: 'project-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PROMPT');
    });

    it('should handle iteration service errors', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockCodeGenerationService.iterateOnCode.mockRejectedValue(new Error('Iteration failed'));

      const response = await request(app)
        .post('/api/generate/iterate')
        .send({
          prompt: 'Add something',
          projectId: 'project-1'
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ITERATION_FAILED');
      expect(response.body.error.message).toBe('Iteration failed');
    });
  });

  describe('POST /api/generate/validate', () => {
    it('should validate files successfully', async () => {
      const files = [
        {
          filename: 'index.html',
          content: '<html><body>Valid HTML</body></html>',
          type: 'html'
        }
      ];

      const response = await request(app)
        .post('/api/generate/validate')
        .send({ files });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('errors');
      expect(response.body.data).toHaveProperty('warnings');
    });

    it('should return 400 for missing files', async () => {
      const response = await request(app)
        .post('/api/generate/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_FILES');
    });

    it('should return 400 for invalid files format', async () => {
      const response = await request(app)
        .post('/api/generate/validate')
        .send({ files: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_FILES');
    });
  });
});