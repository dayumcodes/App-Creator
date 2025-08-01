import { ProjectFileService } from '../../services/ProjectFileService';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';
import { CacheService } from '../../services/CacheService';

// Mock dependencies
jest.mock('../../repositories/ProjectFileRepository');
jest.mock('../../services/CacheService');

describe('ProjectFileService', () => {
  let projectFileService: ProjectFileService;
  let mockProjectFileRepository: jest.Mocked<ProjectFileRepository>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockProjectFileRepository = new ProjectFileRepository() as jest.Mocked<ProjectFileRepository>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    projectFileService = new ProjectFileService(mockProjectFileRepository, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectFiles', () => {
    it('should return cached files if available', async () => {
      const projectId = 'project-123';
      const cachedFiles = [
        { id: '1', filename: 'index.html', content: '<html></html>', type: 'html' },
      ];
      
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedFiles));

      const result = await projectFileService.getProjectFiles(projectId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`project_files:${projectId}`);
      expect(result).toEqual(cachedFiles);
      expect(mockProjectFileRepository.findByProjectId).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      const projectId = 'project-123';
      const dbFiles = [
        { id: '1', filename: 'index.html', content: '<html></html>', type: 'html' },
      ];
      
      mockCacheService.get.mockResolvedValue(null);
      mockProjectFileRepository.findByProjectId.mockResolvedValue(dbFiles);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await projectFileService.getProjectFiles(projectId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`project_files:${projectId}`);
      expect(mockProjectFileRepository.findByProjectId).toHaveBeenCalledWith(projectId);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `project_files:${projectId}`,
        JSON.stringify(dbFiles),
        3600
      );
      expect(result).toEqual(dbFiles);
    });
  });

  describe('createFile', () => {
    it('should create file and invalidate cache', async () => {
      const projectId = 'project-123';
      const fileData = {
        filename: 'app.js',
        content: 'console.log("Hello");',
        type: 'js' as const,
      };
      const createdFile = { id: '1', projectId, ...fileData };

      mockProjectFileRepository.create.mockResolvedValue(createdFile);
      mockCacheService.delete.mockResolvedValue(true);

      const result = await projectFileService.createFile(projectId, fileData);

      expect(mockProjectFileRepository.create).toHaveBeenCalledWith({
        projectId,
        ...fileData,
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(`project_files:${projectId}`);
      expect(result).toEqual(createdFile);
    });

    it('should handle file creation errors', async () => {
      const projectId = 'project-123';
      const fileData = {
        filename: 'app.js',
        content: 'console.log("Hello");',
        type: 'js' as const,
      };
      const error = new Error('File creation failed');

      mockProjectFileRepository.create.mockRejectedValue(error);

      await expect(
        projectFileService.createFile(projectId, fileData)
      ).rejects.toThrow('File creation failed');
    });
  });

  describe('updateFile', () => {
    it('should update file and invalidate cache', async () => {
      const fileId = 'file-123';
      const projectId = 'project-123';
      const updateData = {
        content: 'console.log("Updated");',
      };
      const updatedFile = {
        id: fileId,
        projectId,
        filename: 'app.js',
        type: 'js',
        ...updateData,
      };

      mockProjectFileRepository.update.mockResolvedValue(updatedFile);
      mockProjectFileRepository.findById.mockResolvedValue(updatedFile);
      mockCacheService.delete.mockResolvedValue(true);

      const result = await projectFileService.updateFile(fileId, updateData);

      expect(mockProjectFileRepository.update).toHaveBeenCalledWith(fileId, updateData);
      expect(mockCacheService.delete).toHaveBeenCalledWith(`project_files:${projectId}`);
      expect(result).toEqual(updatedFile);
    });
  });

  describe('deleteFile', () => {
    it('should delete file and invalidate cache', async () => {
      const fileId = 'file-123';
      const projectId = 'project-123';
      const fileToDelete = {
        id: fileId,
        projectId,
        filename: 'app.js',
        type: 'js',
        content: 'console.log("Hello");',
      };

      mockProjectFileRepository.findById.mockResolvedValue(fileToDelete);
      mockProjectFileRepository.delete.mockResolvedValue(undefined);
      mockCacheService.delete.mockResolvedValue(true);

      await projectFileService.deleteFile(fileId);

      expect(mockProjectFileRepository.findById).toHaveBeenCalledWith(fileId);
      expect(mockProjectFileRepository.delete).toHaveBeenCalledWith(fileId);
      expect(mockCacheService.delete).toHaveBeenCalledWith(`project_files:${projectId}`);
    });

    it('should handle file not found', async () => {
      const fileId = 'non-existent-file';

      mockProjectFileRepository.findById.mockResolvedValue(null);

      await expect(projectFileService.deleteFile(fileId)).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('validateFileContent', () => {
    it('should validate HTML content', () => {
      const content = '<html><head><title>Test</title></head><body></body></html>';
      const result = projectFileService.validateFileContent(content, 'html');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate JavaScript content', () => {
      const content = 'const x = 5; console.log(x);';
      const result = projectFileService.validateFileContent(content, 'js');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid JavaScript syntax', () => {
      const content = 'const x = ; // Invalid syntax';
      const result = projectFileService.validateFileContent(content, 'js');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate CSS content', () => {
      const content = 'body { margin: 0; padding: 0; }';
      const result = projectFileService.validateFileContent(content, 'css');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('optimizeFileContent', () => {
    it('should minify JavaScript content', () => {
      const content = `
        function hello() {
          console.log("Hello World");
        }
        hello();
      `;

      const result = projectFileService.optimizeFileContent(content, 'js');

      expect(result.length).toBeLessThan(content.length);
      expect(result).not.toContain('\n');
    });

    it('should minify CSS content', () => {
      const content = `
        body {
          margin: 0;
          padding: 0;
          background-color: white;
        }
      `;

      const result = projectFileService.optimizeFileContent(content, 'css');

      expect(result.length).toBeLessThan(content.length);
      expect(result).not.toContain('\n');
    });

    it('should minify HTML content', () => {
      const content = `
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>
            <h1>Hello World</h1>
          </body>
        </html>
      `;

      const result = projectFileService.optimizeFileContent(content, 'html');

      expect(result.length).toBeLessThan(content.length);
      expect(result).not.toMatch(/\s{2,}/);
    });
  });
});