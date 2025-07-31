import { VersionControlService } from '../../services/VersionControlService';
import { ProjectVersionRepository } from '../../repositories/ProjectVersionRepository';
import { FileSnapshotRepository } from '../../repositories/FileSnapshotRepository';
import { FileChangeRepository } from '../../repositories/FileChangeRepository';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';
import { ChangeType, FileType } from '../../types/database';

// Mock the repositories
jest.mock('../../repositories/ProjectVersionRepository');
jest.mock('../../repositories/FileSnapshotRepository');
jest.mock('../../repositories/FileChangeRepository');
jest.mock('../../repositories/ProjectFileRepository');

describe('VersionControlService', () => {
  let service: VersionControlService;
  let mockProjectVersionRepo: jest.Mocked<ProjectVersionRepository>;
  let mockFileSnapshotRepo: jest.Mocked<FileSnapshotRepository>;
  let mockFileChangeRepo: jest.Mocked<FileChangeRepository>;
  let mockProjectFileRepo: jest.Mocked<ProjectFileRepository>;

  const mockProjectId = 'project-123';
  const mockVersionId = 'version-123';


  beforeEach(() => {
    mockProjectVersionRepo = new ProjectVersionRepository() as jest.Mocked<ProjectVersionRepository>;
    mockFileSnapshotRepo = new FileSnapshotRepository() as jest.Mocked<FileSnapshotRepository>;
    mockFileChangeRepo = new FileChangeRepository() as jest.Mocked<FileChangeRepository>;
    mockProjectFileRepo = new ProjectFileRepository() as jest.Mocked<ProjectFileRepository>;

    service = new VersionControlService(
      mockProjectVersionRepo,
      mockFileSnapshotRepo,
      mockFileChangeRepo,
      mockProjectFileRepo
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createVersion', () => {
    it('should create a version from current project files', async () => {
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

      mockProjectVersionRepo.createVersionFromCurrentFiles.mockResolvedValue(mockVersion);

      const result = await service.createVersion(mockProjectId, 'v1.0.0', 'Initial version');

      expect(mockProjectVersionRepo.createVersionFromCurrentFiles).toHaveBeenCalledWith(
        mockProjectId,
        'v1.0.0',
        'Initial version'
      );
      expect(result).toEqual(mockVersion);
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for a project', async () => {
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

      mockProjectVersionRepo.findByProject.mockResolvedValue(mockVersions);

      const result = await service.getVersionHistory(mockProjectId);

      expect(mockProjectVersionRepo.findByProject).toHaveBeenCalledWith(mockProjectId);
      expect(result).toEqual(mockVersions);
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback project to a specific version', async () => {
      const mockVersion = {
        id: mockVersionId,
        projectId: mockProjectId,
        name: 'v1.0.0',
        description: 'Initial version',
        isActive: false,
        createdAt: new Date(),
        snapshots: [
          {
            id: 'snapshot-1',
            versionId: mockVersionId,
            filename: 'index.html',
            content: '<html>Old content</html>',
            type: FileType.HTML,
            createdAt: new Date(),
          },
        ],
      };

      const mockCurrentFiles = [
        {
          id: 'file-1',
          projectId: mockProjectId,
          filename: 'index.html',
          content: '<html>New content</html>',
          type: FileType.HTML,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockProjectVersionRepo.findByIdWithSnapshots.mockResolvedValue(mockVersion);
      mockProjectFileRepo.findByProject.mockResolvedValue(mockCurrentFiles);
      mockProjectFileRepo.update.mockResolvedValue({
        ...mockCurrentFiles[0],
        content: '<html>Old content</html>',
      });
      mockFileChangeRepo.createBatch.mockResolvedValue([]);
      mockProjectVersionRepo.setActiveVersion.mockResolvedValue(mockVersion);

      await service.rollbackToVersion(mockVersionId);

      expect(mockProjectVersionRepo.findByIdWithSnapshots).toHaveBeenCalledWith(mockVersionId);
      expect(mockProjectFileRepo.findByProject).toHaveBeenCalledWith(mockProjectId);
      expect(mockProjectFileRepo.update).toHaveBeenCalledWith('file-1', {
        content: '<html>Old content</html>',
        type: FileType.HTML,
      });
      expect(mockProjectVersionRepo.setActiveVersion).toHaveBeenCalledWith(mockVersionId);
    });
  });

  describe('trackFileChange', () => {
    it('should track a file change', async () => {
      const mockChange = {
        id: 'change-1',
        projectId: mockProjectId,
        filename: 'index.html',
        oldContent: '<html>Old</html>',
        newContent: '<html>New</html>',
        changeType: ChangeType.UPDATE,
        createdAt: new Date(),
      };

      mockFileChangeRepo.create.mockResolvedValue(mockChange);

      const result = await service.trackFileChange(
        mockProjectId,
        'index.html',
        '<html>Old</html>',
        '<html>New</html>',
        ChangeType.UPDATE
      );

      expect(mockFileChangeRepo.create).toHaveBeenCalledWith({
        projectId: mockProjectId,
        filename: 'index.html',
        oldContent: '<html>Old</html>',
        newContent: '<html>New</html>',
        changeType: ChangeType.UPDATE,
      });
      expect(result).toEqual(mockChange);
    });
  });

  describe('undoLastChange', () => {
    it('should undo the last UPDATE change', async () => {
      const mockChange = {
        id: 'change-1',
        projectId: mockProjectId,
        filename: 'index.html',
        oldContent: '<html>Old</html>',
        newContent: '<html>New</html>',
        changeType: ChangeType.UPDATE,
        createdAt: new Date(),
      };

      const mockCurrentFile = {
        id: 'file-1',
        projectId: mockProjectId,
        filename: 'index.html',
        content: '<html>New</html>',
        type: FileType.HTML,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileChangeRepo.findByProject.mockResolvedValue([mockChange]);
      mockProjectFileRepo.findByProjectAndFilename.mockResolvedValue(mockCurrentFile);
      mockProjectFileRepo.update.mockResolvedValue(mockCurrentFile);
      mockFileChangeRepo.delete.mockResolvedValue(mockChange);

      const result = await service.undoLastChange(mockProjectId);

      expect(mockFileChangeRepo.findByProject).toHaveBeenCalledWith(mockProjectId, 1);
      expect(mockProjectFileRepo.update).toHaveBeenCalledWith('file-1', {
        content: '<html>Old</html>',
      });
      expect(mockFileChangeRepo.delete).toHaveBeenCalledWith('change-1');
      expect(result).toBe(true);
    });

    it('should return false when no changes to undo', async () => {
      mockFileChangeRepo.findByProject.mockResolvedValue([]);

      const result = await service.undoLastChange(mockProjectId);

      expect(result).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and return diffs', async () => {
      const mockVersion1 = {
        id: 'version-1',
        projectId: mockProjectId,
        name: 'v1.0.0',
        description: 'Version 1',
        isActive: false,
        createdAt: new Date(),
        snapshots: [
          {
            id: 'snapshot-1',
            versionId: 'version-1',
            filename: 'index.html',
            content: '<html>Version 1</html>',
            type: FileType.HTML,
            createdAt: new Date(),
          },
        ],
      };

      const mockVersion2 = {
        id: 'version-2',
        projectId: mockProjectId,
        name: 'v2.0.0',
        description: 'Version 2',
        isActive: true,
        createdAt: new Date(),
        snapshots: [
          {
            id: 'snapshot-2',
            versionId: 'version-2',
            filename: 'index.html',
            content: '<html>Version 2</html>',
            type: FileType.HTML,
            createdAt: new Date(),
          },
        ],
      };

      mockProjectVersionRepo.findByIdWithSnapshots
        .mockResolvedValueOnce(mockVersion1)
        .mockResolvedValueOnce(mockVersion2);

      const result = await service.compareVersions('version-1', 'version-2');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filename: 'index.html',
        oldContent: '<html>Version 1</html>',
        newContent: '<html>Version 2</html>',
        changeType: ChangeType.UPDATE,
      });
      expect(result[0]?.diff).toContain('- <html>Version 1</html>');
      expect(result[0]?.diff).toContain('+ <html>Version 2</html>');
    });
  });

  describe('getUndoRedoState', () => {
    it('should return undo/redo state', async () => {
      mockFileChangeRepo.getChangeCount.mockResolvedValue(5);

      const result = await service.getUndoRedoState(mockProjectId);

      expect(mockFileChangeRepo.getChangeCount).toHaveBeenCalledWith(mockProjectId);
      expect(result).toEqual({
        canUndo: true,
        canRedo: false,
        currentPosition: 5,
        totalChanges: 5,
      });
    });

    it('should return false for canUndo when no changes', async () => {
      mockFileChangeRepo.getChangeCount.mockResolvedValue(0);

      const result = await service.getUndoRedoState(mockProjectId);

      expect(result).toEqual({
        canUndo: false,
        canRedo: false,
        currentPosition: 0,
        totalChanges: 0,
      });
    });
  });

  describe('createExperimentalBranch', () => {
    it('should create an experimental branch with timestamp', async () => {
      const mockBranch = {
        id: 'branch-123',
        projectId: mockProjectId,
        name: 'feature-experiment-20240125T120000',
        description: 'Experimental branch',
        isActive: true,
        createdAt: new Date(),
        snapshots: [],
      };

      mockProjectVersionRepo.createVersionFromCurrentFiles.mockResolvedValue(mockBranch);

      const result = await service.createExperimentalBranch(
        mockProjectId,
        'feature',
        'Experimental branch'
      );

      expect(mockProjectVersionRepo.createVersionFromCurrentFiles).toHaveBeenCalledWith(
        mockProjectId,
        expect.stringMatching(/^feature-experiment-\d{8}T\d{6}$/),
        'Experimental branch'
      );
      expect(result).toEqual(mockBranch);
    });
  });
});