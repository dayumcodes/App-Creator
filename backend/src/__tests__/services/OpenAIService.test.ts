import { OpenAIService } from '../../services/OpenAIService';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('OpenAIService', () => {
  let openAIService: OpenAIService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Set up environment variable
    process.env['OPENAI_API_KEY'] = 'test-api-key';
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mocked OpenAI constructor
    const OpenAI = require('openai').default;
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockReturnValue(mockOpenAI);
    
    openAIService = new OpenAIService();
  });

  afterEach(() => {
    delete process.env['OPENAI_API_KEY'];
  });

  describe('constructor', () => {
    it('should throw error if OPENAI_API_KEY is not set', () => {
      delete process.env['OPENAI_API_KEY'];
      expect(() => new OpenAIService()).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should initialize OpenAI client with API key', () => {
      const OpenAI = require('openai').default;
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
    });
  });

  describe('generateCode', () => {
    it('should generate code successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '===== index.html =====\n<html><body>Hello World</body></html>'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await openAIService.generateCode('Create a hello world page');

      expect(result).toBe('===== index.html =====\n<html><body>Hello World</body></html>');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: expect.stringContaining('You are an expert web developer') },
          { role: 'user', content: 'Create a hello world page' }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });
    });

    it('should include context in the prompt when provided', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Generated code with context'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await openAIService.generateCode('Add a button', 'Existing HTML content');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: expect.stringContaining('You are an expert web developer') },
          { role: 'user', content: 'Context: Existing HTML content\n\nRequest: Add a button' }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Success on retry'
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await openAIService.generateCode('Test prompt');

      expect(result).toBe('Success on retry');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Persistent API Error'));

      await expect(openAIService.generateCode('Test prompt')).rejects.toThrow(
        'OpenAI API failed after 3 attempts: Persistent API Error'
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should throw error if no response content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(openAIService.generateCode('Test prompt')).rejects.toThrow(
        'No response received from OpenAI'
      );
    });
  });

  describe('modifyCode', () => {
    it('should modify code successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '<html><body><h1>Modified</h1></body></html>'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await openAIService.modifyCode(
        'Add a heading',
        '<html><body></body></html>',
        'index.html'
      );

      expect(result).toBe('<html><body><h1>Modified</h1></body></html>');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: expect.stringContaining('You are an expert web developer assistant that modifies') },
          { role: 'user', content: 'File: index.html\n\nExisting code:\n<html><body></body></html>\n\nModification request: Add a heading' }
        ],
        temperature: 0.5,
        max_tokens: 4000
      });
    });

    it('should retry on modification failure', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Modified code'
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await openAIService.modifyCode('Test', 'code', 'file.js');

      expect(result).toBe('Modified code');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries for modification', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Persistent Error'));

      await expect(openAIService.modifyCode('Test', 'code', 'file.js')).rejects.toThrow(
        'OpenAI API modification failed after 3 attempts: Persistent Error'
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });
  });
});