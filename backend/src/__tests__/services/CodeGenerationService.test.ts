import { CodeGenerationService } from '../../services/CodeGenerationService';
import { OpenAIService } from '../../services/OpenAIService';
import { CodeValidationService } from '../../services/CodeValidationService';
import { PromptHistoryRepository } from '../../repositories/PromptHistoryRepository';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';
import { FileType } from '../../generated/prisma';

// Mock all dependencies
jest.mock('../../services/OpenAIService');
jest.mock('../../services/CodeValidationService');
jest.mock('../../repositories/PromptHistoryRepository');
jest.mock('../../repositories/ProjectFileRepository');

describe('CodeGenerationService', () => {
  let codeGenerationService: CodeGenerationService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let mockValidationService: jest.Mocked<CodeValidationService>;
  let mockPromptHistoryRepo: jest.Mocked<PromptHistoryRepository>;
  let mockProjectFileRepo: jest.Mocked<ProjectFileRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockOpenAIService = new OpenAIService() as jest.Mocked<OpenAIService>;
    mockValidationService = new CodeValidationService() as jest.Mocked<CodeValidationService>;
    mockPromptHistoryRepo = new PromptHistoryRepository() as jest.Mocked<PromptHistoryRepository>;
    mockProjectFileRepo = new ProjectFileRepository() as jest.Mocked<ProjectFileRepository>;

    // Mock constructors to return our mocked instances
    (OpenAIService as jest.MockedClass<typeof OpenAIService>).mockImplementation(() => mockOpenAIService);
    (CodeValidationService as jest.MockedClass<typeof CodeValidationService>).mockImplementation(() => mockValidationService);
    (PromptHistoryRepository as jest.MockedClass<typeof PromptHistoryRepository>).mockImplementation(() => mockPromptHistoryRepo);
    (ProjectFileRepository as jest.MockedClass<typeof ProjectFileRepository>).mockImplementation(() => mockProjectFileRepo);

    codeGenerationService = new CodeGenerationService();
  });

  describe('generateApplication', () => {
    it('should generate application successfully', async () => {
      const mockGeneratedCode = `===== index.html =====
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello World</h1></body>
</html>

===== styles.css =====
body { margin: 0; }`;

      mockOpenAIService.generateCode.mockResolvedValue(mockGeneratedCode);
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        prompt: 'Create a hello world page',
        response: mockGeneratedCode,
        filesChanged: ['index.html', 'styles.css'],
        createdAt: new Date()
      });

      const result = await codeGenerationService.generateApplication(
        'Create a hello world page',
        'project-1',
        'user-1'
      );

      expect(result.files).toHaveLength(2);
      expect(result.files[0]?.filename).toBe('index.html');
      expect(result.files[1]?.filename).toBe('styles.css');
      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);

      expect(mockOpenAIService.generateCode).toHaveBeenCalledWith(
        expect.stringContaining('Create a hello world page')
      );
      expect(mockValidationService.validateFiles).toHaveBeenCalledWith(result.files);
      expect(mockPromptHistoryRepo.create).toHaveBeenCalled();
    });

    it('should handle single file without delimiters', async () => {
      const mockGeneratedCode = '<html><body>Simple HTML</body></html>';

      mockOpenAIService.generateCode.mockResolvedValue(mockGeneratedCode);
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        prompt: 'Create simple page',
        response: mockGeneratedCode,
        filesChanged: ['index.html'],
        createdAt: new Date()
      });

      const result = await codeGenerationService.generateApplication(
        'Create simple page',
        'project-1',
        'user-1'
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filename).toBe('index.html');
      expect(result.files[0]?.content).toBe(mockGeneratedCode);
      expect(result.files[0]?.type).toBe('HTML');
    });

    it('should handle validation errors', async () => {
      const mockGeneratedCode = '===== index.html =====\n<html><body>Invalid HTML';

      mockOpenAIService.generateCode.mockResolvedValue(mockGeneratedCode);
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: false,
        errors: ['Missing closing tags'],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        prompt: 'Create page',
        response: mockGeneratedCode,
        filesChanged: ['index.html'],
        createdAt: new Date()
      });

      const result = await codeGenerationService.generateApplication(
        'Create page',
        'project-1',
        'user-1'
      );

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Missing closing tags');
    });

    it('should handle OpenAI service errors', async () => {
      mockOpenAIService.generateCode.mockRejectedValue(new Error('API Error'));

      await expect(codeGenerationService.generateApplication(
        'Create page',
        'project-1',
        'user-1'
      )).rejects.toThrow('Failed to generate application: API Error');
    });
  });

  describe('iterateOnCode', () => {
    it('should iterate on existing code successfully', async () => {
      const existingFiles = [
        {
          id: '1',
          projectId: 'project-1',
          filename: 'index.html',
          content: '<html><body><h1>Original</h1></body></html>',
          type: FileType.HTML,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const modifiedContent = '<html><body><h1>Modified</h1><p>Added paragraph</p></body></html>';

      mockProjectFileRepo.findByProject.mockResolvedValue(existingFiles);
      mockOpenAIService.modifyCode.mockResolvedValue(modifiedContent);
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '2',
        projectId: 'project-1',
        prompt: 'Add a paragraph',
        response: JSON.stringify([{ filename: 'index.html', content: modifiedContent, type: 'html' }]),
        filesChanged: ['index.html'],
        createdAt: new Date()
      });

      const result = await codeGenerationService.iterateOnCode(
        'Add a paragraph',
        'project-1',
        'user-1'
      );

      expect(result.modifiedFiles).toHaveLength(1);
      expect(result.modifiedFiles[0]?.content).toBe(modifiedContent);
      expect(result.isValid).toBe(true);

      expect(mockOpenAIService.modifyCode).toHaveBeenCalledWith(
        'Add a paragraph',
        existingFiles[0]?.content,
        existingFiles[0]?.filename
      );
    });

    it('should throw error if no existing files found', async () => {
      mockProjectFileRepo.findByProject.mockResolvedValue([]);

      await expect(codeGenerationService.iterateOnCode(
        'Add something',
        'project-1',
        'user-1'
      )).rejects.toThrow('No existing files found for iteration');
    });

    it('should determine files to modify based on prompt', async () => {
      const existingFiles = [
        {
          id: '1',
          projectId: 'project-1',
          filename: 'index.html',
          content: '<html><body></body></html>',
          type: FileType.HTML,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          projectId: 'project-1',
          filename: 'styles.css',
          content: 'body { margin: 0; }',
          type: FileType.CSS,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockProjectFileRepo.findByProject.mockResolvedValue(existingFiles);
      mockOpenAIService.modifyCode.mockResolvedValue('modified content');
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '2',
        projectId: 'project-1',
        prompt: 'Change the color to red',
        response: JSON.stringify([]),
        filesChanged: ['styles.css'],
        createdAt: new Date()
      });

      await codeGenerationService.iterateOnCode(
        'Change the color to red',
        'project-1',
        'user-1'
      );

      // Should only modify CSS file based on the prompt
      expect(mockOpenAIService.modifyCode).toHaveBeenCalledTimes(1);
      expect(mockOpenAIService.modifyCode).toHaveBeenCalledWith(
        'Change the color to red',
        'body { margin: 0; }',
        'styles.css'
      );
    });
  });

  describe('file type detection', () => {
    it('should detect file types correctly', async () => {
      const mockGeneratedCode = `===== index.html =====
<html></html>

===== styles.css =====
body {}

===== script.js =====
console.log('test');

===== config.json =====
{"test": true}`;

      mockOpenAIService.generateCode.mockResolvedValue(mockGeneratedCode);
      mockValidationService.validateFiles.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockPromptHistoryRepo.create.mockResolvedValue({
        id: '1',
        projectId: 'project-1',
        prompt: 'Create files',
        response: mockGeneratedCode,
        filesChanged: ['index.html', 'styles.css', 'script.js', 'config.json'],
        createdAt: new Date()
      });

      const result = await codeGenerationService.generateApplication(
        'Create files',
        'project-1',
        'user-1'
      );

      expect(result.files[0]?.type).toBe('HTML');
      expect(result.files[1]?.type).toBe('CSS');
      expect(result.files[2]?.type).toBe('JS');
      expect(result.files[3]?.type).toBe('JSON');
    });
  });
});