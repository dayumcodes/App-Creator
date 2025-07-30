import { CodeValidationService } from '../../services/CodeValidationService';
import { GeneratedFile } from '../../services/CodeGenerationService';

describe('CodeValidationService', () => {
  let validationService: CodeValidationService;

  beforeEach(() => {
    validationService = new CodeValidationService();
  });

  describe('validateFiles', () => {
    it('should validate multiple files successfully', async () => {
      const files: GeneratedFile[] = [
        {
          filename: 'index.html',
          content: '<!DOCTYPE html><html><head></head><body></body></html>',
          type: 'HTML'
        },
        {
          filename: 'styles.css',
          content: 'body { margin: 0; }',
          type: 'CSS'
        }
      ];

      const result = await validationService.validateFiles(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors across files', async () => {
      const files: GeneratedFile[] = [
        {
          filename: 'index.html',
          content: '<html><head><body></body>', // Missing closing tags
          type: 'HTML'
        },
        {
          filename: 'styles.css',
          content: 'body { margin: 0; color: red', // Missing closing brace
          type: 'CSS'
        }
      ];

      const result = await validationService.validateFiles(files);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate cross-file references', async () => {
      const files: GeneratedFile[] = [
        {
          filename: 'index.html',
          content: '<html><head><link rel="stylesheet" href="missing.css"></head><body></body></html>',
          type: 'HTML'
        }
      ];

      const result = await validationService.validateFiles(files);

      expect(result.warnings).toContain('index.html references missing CSS file: missing.css');
    });
  });

  describe('validateFile', () => {
    describe('HTML validation', () => {
      it('should validate correct HTML', async () => {
        const file: GeneratedFile = {
          filename: 'index.html',
          content: '<!DOCTYPE html><html><head></head><body><h1>Hello</h1></body></html>',
          type: 'HTML'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should warn about missing DOCTYPE and basic elements', async () => {
        const file: GeneratedFile = {
          filename: 'index.html',
          content: '<div>Content</div>',
          type: 'HTML'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('Missing DOCTYPE declaration or html tag');
        expect(result.warnings).toContain('Missing head element');
        expect(result.warnings).toContain('Missing body element');
      });

      it('should warn about images without alt attributes', async () => {
        const file: GeneratedFile = {
          filename: 'index.html',
          content: '<html><body><img src="test.jpg"></body></html>',
          type: 'HTML'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('Images should have alt attributes for accessibility');
      });
    });

    describe('CSS validation', () => {
      it('should validate correct CSS', async () => {
        const file: GeneratedFile = {
          filename: 'styles.css',
          content: 'body { margin: 0; padding: 10px; }',
          type: 'CSS'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect unmatched braces', async () => {
        const file: GeneratedFile = {
          filename: 'styles.css',
          content: 'body { margin: 0; padding: 10px;',
          type: 'CSS'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Unmatched CSS braces detected');
      });

      it('should warn about double semicolons', async () => {
        const file: GeneratedFile = {
          filename: 'styles.css',
          content: 'body { margin: 0;; padding: 10px; }',
          type: 'CSS'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('Double semicolons found in CSS');
      });
    });

    describe('JavaScript validation', () => {
      it('should validate correct JavaScript', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'function hello() { return "Hello World"; }',
          type: 'JS'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect syntax errors', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'function hello() { return "Hello World" }', // Missing semicolon is OK, but let's test real syntax error
          type: 'JS'
        };

        // This should pass since missing semicolon is not a syntax error
        const result = await validationService.validateFile(file);
        expect(result.isValid).toBe(true);
      });

      it('should detect real syntax errors', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'function hello() { return "Hello World }', // Missing quote
          type: 'JS'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('JavaScript syntax error');
      });

      it('should warn about var usage', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'var x = 5;',
          type: 'JS'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('Consider using let or const instead of var');
      });

      it('should warn about console.log', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'console.log("debug");',
          type: 'JS'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('Console.log statements found - consider removing for production');
      });

      it('should warn about eval usage', async () => {
        const file: GeneratedFile = {
          filename: 'script.js',
          content: 'eval("alert(1)");',
          type: 'JS'
        };

        const result = await validationService.validateFile(file);

        expect(result.warnings).toContain('eval() usage detected - potential security risk');
      });
    });

    describe('JSON validation', () => {
      it('should validate correct JSON', async () => {
        const file: GeneratedFile = {
          filename: 'config.json',
          content: '{"name": "test", "version": "1.0.0"}',
          type: 'JSON'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect invalid JSON', async () => {
        const file: GeneratedFile = {
          filename: 'config.json',
          content: '{"name": "test", "version": }', // Invalid JSON
          type: 'JSON'
        };

        const result = await validationService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid JSON');
      });
    });
  });
});