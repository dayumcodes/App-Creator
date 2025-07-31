import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  CustomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  asyncHandler,
  notFoundHandler,
} from '../../middleware/errorHandler';

// Mock logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Custom Error Classes', () => {
    it('should create CustomError with correct properties', () => {
      const error = new CustomError('Test error', 400, 'TEST_ERROR', { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.isOperational).toBe(true);
    });

    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError('Validation failed', { field: 'email' });
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError();
      
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Authentication failed');
    });

    it('should create AuthorizationError with correct defaults', () => {
      const error = new AuthorizationError();
      
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.message).toBe('Access denied');
    });

    it('should create NotFoundError with correct defaults', () => {
      const error = new NotFoundError();
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.message).toBe('Resource not found');
    });

    it('should create ConflictError with correct properties', () => {
      const error = new ConflictError('Resource exists', { id: '123' });
      
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.details).toEqual({ id: '123' });
    });

    it('should create RateLimitError with correct defaults', () => {
      const error = new RateLimitError();
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.message).toBe('Too many requests');
    });

    it('should create ExternalServiceError with correct properties', () => {
      const error = new ExternalServiceError('Service unavailable', { service: 'openai' });
      
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.details).toEqual({ service: 'openai' });
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle CustomError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          suggestions: expect.arrayContaining([
            'Please check your input data and try again',
            'Ensure all required fields are filled',
            'Verify that data formats are correct'
          ])
        }
      });
    });

    it('should handle generic Error with default status', () => {
      const error = new Error('Generic error');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Generic error',
          suggestions: expect.arrayContaining([
            'Please try again later',
            'Refresh the page',
            'Contact support if the problem persists'
          ])
        }
      });
    });

    it('should handle JWT errors', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token',
          suggestions: expect.arrayContaining([
            'Please log in again',
            'Check your credentials and try again',
            'Clear your browser cache and cookies'
          ])
        }
      });
    });

    it('should handle expired token errors', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Token expired',
          suggestions: expect.arrayContaining([
            'Please log in again',
            'Check your credentials and try again',
            'Clear your browser cache and cookies'
          ])
        }
      });
    });

    it('should handle validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          suggestions: expect.arrayContaining([
            'Please check your input data and try again',
            'Ensure all required fields are filled',
            'Verify that data formats are correct'
          ])
        }
      });
    });

    it('should handle duplicate key errors', () => {
      const error: any = new Error('Duplicate key');
      error.code = 11000;
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT_ERROR',
          message: 'Duplicate field value entered',
          suggestions: expect.arrayContaining([
            'The resource already exists',
            'Try using a different name or identifier',
            'Refresh the page and try again'
          ])
        }
      });
    });

    it('should include details and stack in development mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      
      const error = new ValidationError('Test error', { field: 'test' });
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Test error',
          details: { field: 'test' },
          suggestions: expect.any(Array)
        })
      });
      
      // Check that details are included in development mode
      expect(responseCall.error.details).toEqual({ field: 'test' });
      
      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('Async Handler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Not Found Handler', () => {
    it('should create NotFoundError for unknown routes', () => {
      mockRequest.originalUrl = '/unknown-route';
      
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: 'NOT_FOUND_ERROR',
          message: 'Route /unknown-route not found'
        })
      );
    });
  });

  describe('Recovery Suggestions', () => {
    it('should provide appropriate suggestions for different error types', () => {
      const testCases = [
        {
          error: new ValidationError('Test'),
          expectedSuggestions: [
            'Please check your input data and try again',
            'Ensure all required fields are filled',
            'Verify that data formats are correct'
          ]
        },
        {
          error: new AuthenticationError(),
          expectedSuggestions: [
            'Please log in again',
            'Check your credentials and try again',
            'Clear your browser cache and cookies'
          ]
        },
        {
          error: new RateLimitError(),
          expectedSuggestions: [
            'Please wait a moment before trying again',
            'Reduce the frequency of your requests',
            'Try again in a few minutes'
          ]
        }
      ];

      testCases.forEach(({ error, expectedSuggestions }) => {
        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
        
        const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(responseCall.error.suggestions).toEqual(expectedSuggestions);
        
        jest.clearAllMocks();
      });
    });
  });
});