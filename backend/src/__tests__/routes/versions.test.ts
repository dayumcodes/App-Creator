import request from 'supertest';
import app from '../../index';
import { VersionControlService } from '../../services/VersionControlService';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { ChangeType, FileType } from '../../types/database';
import jwt from 'jsonwebtoken';

// Mock the services and repositories
jest.mock('../../services/VersionControlService');
jest.mock('../../repositories/ProjectRepository');
jest.mock('../../repositories/ProjectVersionRepository');
jest.mock('../../repositories/FileSnapshotRepository');
jest.mock('../../repositories/FileChangeRepository');
jest.mock('../../repositories/ProjectFileRepository');

describe('Version Control Routes', () => {
  let mockVersionControlService: jest.Mocked<VersionControlService>;
  let mockProjectRepo: jest.Mocked<ProjectRepository>;
  let authToken: string;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';
  const mockVersionId = 'version-123';

  beforeEach(() => {
    // Create auth token
    authToken = jwt.sign(
      { userId: mockUserId, email: 'test@example.com' },
      process.env['JWT_SECRET'] || 'test-secret'
    );

    // Mock project repository
    mockProjectRepo = new ProjectRepository() as jest.Mocked<ProjectRepository>;
    mockProjectRepo.findById.mockResolvedValue({
      id: mockProjectId,
      userId: mockUserId,
      name: 'Test Project',
      description: 'Test Description',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock version control service
    mockVersionControlService = new VersionControlService(
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<VersionControlService>;

    // Replace the service instances in the routes module
    jest.doMock('../../services/VersionControlService', () => ({
      VersionControlService: jest.fn(() => mockVersionControlService),
    }));
    jest.doMock('../../repositories/ProjectRepository', () => ({
      ProjectRepository: jest.fn(() => mockProjectRepo),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /:projectId/versions', () => {
    it('should create a new version', async () => {
      const mockVersion = {
        id: mockVersionId,
        projectId: mockProjectId,
        name: 'v1.0.0',
        description: 'Initial version',
        isActive: true,
        createdAt: new Date(),
        snapshots: [],
      };

      mockVersionControlService.createVersion.mockResolvedValue(mockVersion);

      const response = await request(app)
        .post(`/api/${mockProjectId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'v1.0.0',
          description: 'Initial version',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVersion);
      expect(mockVersionControlService.createVersion).toHaveBeenCalledWith(
        mockProjectId,
        'v1.0.0',
        'Initial version'
      );
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post(`/api/${mockProjectId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Initial version',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Version name is required');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/${mockProjectId}/versions`)
        .send({
          name: 'v1.0.0',
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user does not own project', async () => {
      mockProjectRepo.findById.mockResolvedValue({
        id: mockProjectId,
        userId: 'other-user',
        name: 'Test Project',
        description: 'Test Description',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/${mockProjectId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'v1.0.0',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /:projectId/versions', () => {
    it('should return version history', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          projectId: mockProjectId,
          name: 'v1.0.0',
          description: 'Initial version',
          isActive: false,
          createdAt: new Date(),
        },
        {
          id: 'version-2',
          projectId: mockProjectId,
          name: 'v1.1.0',
          description: 'Bug fixes',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      mockVersionControlService.getVersionHistory.mockResolvedValue(mockVersions);

      const response = await request(app)
        .get(`/api/${mockProjectId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVersions);
      expect(mockVersionControlService.getVersionHistory).toHaveBeenCalledWith(mockProjectId);
    });
  });

  describe('GET /:projectId/versions/:versionId', () => {
    it('should return version with files', async () => {
      const mockVersion = {
        id: mockVersionId,
        projectId: mockProjectId,
        name: 'v1.0.0',
        description: 'Initial version',
        isActive: true,
        createdAt: new Date(),
        snapshots: [
          {
            id: 'snapshot-1',
            versionId: mockVersionId,
            filename: 'index.html',
            content: '<html></html>',
            type: FileType.HTML,
            createdAt: new Date(),
          },
        ],
      };

      mockVersionControlService.getVersionWithFiles.mockResolvedValue(mockVersion);

      const response = await request(app)
        .get(`/api/${mockProjectId}/versions/${mockVersionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVersion);
      expect(mockVersionControlService.getVersionWithFiles).toHaveBeenCalledWith(mockVersionId);
    });
  });

  describe('POST /:projectId/versions/:versionId/rollback', () => {
    it('should rollback to version', async () => {
      mockVersionControlService.rollbackToVersion.mockResolvedValue();

      const response = await request(app)
        .post(`/api/${mockProjectId}/versions/${mockVersionId}/rollback`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully rolled back to version');
      expect(mockVersionControlService.rollbackToVersion).toHaveBeenCalledWith(mockVersionId);
    });
  });

  describe('GET /:projectId/changes', () => {
    it('should return change history', async () => {
      const mockChanges = [
        {
          id: 'change-1',
          projectId: mockProjectId,
          filename: 'index.html',
          oldContent: '<html>Old</html>',
          newContent: '<html>New</html>',
          changeType: ChangeType.UPDATE,
          createdAt: new Date(),
        },
        {
          id: 'change-2',
          projectId: mockProjectId,
          filename: 'style.css',
          oldContent: null,
          newContent: 'body { color: red; }',
          changeType: ChangeType.CREATE,
          createdAt: new Date(),
        },
      ];

      mockVersionControlService.getChangeHistory.mockResolvedValue(mockChanges);

      const response = await request(app)
        .get(`/api/${mockProjectId}/changes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockChanges);
      expect(mockVersionControlService.getChangeHistory).toHaveBeenCalledWith(
        mockProjectId,
        undefined,
        undefined
      );
    });

    it('should handle limit and offset parameters', async () => {
      mockVersionControlService.getChangeHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/${mockProjectId}/changes?limit=10&offset=20`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockVersionControlService.getChangeHistory).toHaveBeenCalledWith(
        mockProjectId,
        10,
        20
      );
    });
  });

  describe('POST /:projectId/undo', () => {
    it('should undo last change', async () => {
      mockVersionControlService.undoLastChange.mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/${mockProjectId}/undo`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully undid last change');
      expect(mockVersionControlService.undoLastChange).toHaveBeenCalledWith(mockProjectId);
    });

    it('should return 400 if no changes to undo', async () => {
      mockVersionControlService.undoLastChange.mockResolvedValue(false);

      const response = await request(app)
        .post(`/api/${mockProjectId}/undo`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No changes to undo');
    });
  });

  describe('GET /:projectId/undo-state', () => {
    it('should return undo/redo state', async () => {
      const mockState = {
        canUndo: true,
        canRedo: false,
        currentPosition: 5,
        totalChanges: 5,
      };

      mockVersionControlService.getUndoRedoState.mockResolvedValue(mockState);

      const response = await request(app)
        .get(`/api/${mockProjectId}/undo-state`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockState);
      expect(mockVersionControlService.getUndoRedoState).toHaveBeenCalledWith(mockProjectId);
    });
  });

  describe('GET /:projectId/compare/:versionId1/:versionId2', () => {
    it('should compare two versions', async () => {
      const mockDiffs = [
        {
          filename: 'index.html',
          oldContent: '<html>Old</html>',
          newContent: '<html>New</html>',
          diff: '- <html>Old</html>\n+ <html>New</html>',
          changeType: ChangeType.UPDATE,
        },
      ];

      mockVersionControlService.compareVersions.mockResolvedValue(mockDiffs);

      const response = await request(app)
        .get(`/api/${mockProjectId}/compare/version-1/version-2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDiffs);
      expect(mockVersionControlService.compareVersions).toHaveBeenCalledWith(
        'version-1',
        'version-2'
      );
    });
  });

  describe('GET /:projectId/compare/:versionId/current', () => {
    it('should compare version with current state', async () => {
      const mockDiffs = [
        {
          filename: 'index.html',
          oldContent: '<html>Version</html>',
          newContent: '<html>Current</html>',
          diff: '- <html>Version</html>\n+ <html>Current</html>',
          changeType: ChangeType.UPDATE,
        },
      ];

      mockVersionControlService.compareWithCurrentState.mockResolvedValue(mockDiffs);

      const response = await request(app)
        .get(`/api/${mockProjectId}/compare/${mockVersionId}/current`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDiffs);
      expect(mockVersionControlService.compareWithCurrentState).toHaveBeenCalledWith(mockVersionId);
    });
  });

  describe('POST /:projectId/branch', () => {
    it('should create experimental branch', async () => {
      const mockBranch = {
        id: 'branch-123',
        projectId: mockProjectId,
        name: 'feature-experiment-20240125T120000',
        description: 'Experimental branch',
        isActive: true,
        createdAt: new Date(),
        snapshots: [],
      };

      mockVersionControlService.createExperimentalBranch.mockResolvedValue(mockBranch);

      const response = await request(app)
        .post(`/api/${mockProjectId}/branch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          baseName: 'feature',
          description: 'Experimental branch',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBranch);
      expect(mockVersionControlService.createExperimentalBranch).toHaveBeenCalledWith(
        mockProjectId,
        'feature',
        'Experimental branch'
      );
    });

    it('should return 400 if baseName is missing', async () => {
      const response = await request(app)
        .post(`/api/${mockProjectId}/branch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Experimental branch',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Base name is required');
    });
  });
});