import { ErrorMessages, getErrorMessage, formatErrorMessage } from '../../utils/errorMessages';

describe('ErrorMessages', () => {
  describe('getErrorMessage', () => {
    it('should return correct message for authentication errors', () => {
      expect(getErrorMessage('AUTH_INVALID_CREDENTIALS')).toBe(
        'Invalid email or password. Please check your credentials and try again.'
      );
      expect(getErrorMessage('AUTH_TOKEN_EXPIRED')).toBe(
        'Your session has expired. Please log in again.'
      );
      expect(getErrorMessage('AUTH_UNAUTHORIZED')).toBe(
        'You are not authorized to perform this action.'
      );
    });

    it('should return correct message for validation errors', () => {
      expect(getErrorMessage('VALIDATION_REQUIRED_FIELD')).toBe(
        'This field is required and cannot be empty.'
      );
      expect(getErrorMessage('VALIDATION_INVALID_EMAIL')).toBe(
        'Please enter a valid email address.'
      );
      expect(getErrorMessage('VALIDATION_PASSWORD_TOO_SHORT')).toBe(
        'Password must be at least 8 characters long.'
      );
    });

    it('should return correct message for project errors', () => {
      expect(getErrorMessage('PROJECT_NOT_FOUND')).toBe(
        'The requested project could not be found.'
      );
      expect(getErrorMessage('PROJECT_ACCESS_DENIED')).toBe(
        'You do not have permission to access this project.'
      );
      expect(getErrorMessage('PROJECT_NAME_EXISTS')).toBe(
        'A project with this name already exists.'
      );
    });

    it('should return correct message for file errors', () => {
      expect(getErrorMessage('FILE_NOT_FOUND')).toBe(
        'The requested file could not be found.'
      );
      expect(getErrorMessage('FILE_TOO_LARGE')).toBe(
        'The file size exceeds the maximum allowed limit.'
      );
      expect(getErrorMessage('FILE_INVALID_TYPE')).toBe(
        'This file type is not supported.'
      );
    });

    it('should return correct message for AI service errors', () => {
      expect(getErrorMessage('AI_SERVICE_UNAVAILABLE')).toBe(
        'The AI service is currently unavailable. Please try again later.'
      );
      expect(getErrorMessage('AI_QUOTA_EXCEEDED')).toBe(
        'You have exceeded your AI usage quota for this period.'
      );
      expect(getErrorMessage('AI_INVALID_PROMPT')).toBe(
        'The prompt contains invalid or inappropriate content.'
      );
    });

    it('should return correct message for database errors', () => {
      expect(getErrorMessage('DATABASE_CONNECTION_ERROR')).toBe(
        'Unable to connect to the database. Please try again later.'
      );
      expect(getErrorMessage('DATABASE_QUERY_ERROR')).toBe(
        'An error occurred while processing your request.'
      );
      expect(getErrorMessage('DATABASE_CONSTRAINT_VIOLATION')).toBe(
        'The operation violates data integrity constraints.'
      );
    });

    it('should return correct message for deployment errors', () => {
      expect(getErrorMessage('DEPLOYMENT_FAILED')).toBe(
        'Deployment failed. Please check your configuration and try again.'
      );
      expect(getErrorMessage('DEPLOYMENT_TIMEOUT')).toBe(
        'Deployment timed out. The process is taking longer than expected.'
      );
      expect(getErrorMessage('DEPLOYMENT_INVALID_CONFIG')).toBe(
        'Invalid deployment configuration. Please review your settings.'
      );
    });

    it('should return generic message for unknown error codes', () => {
      expect(getErrorMessage('UNKNOWN_ERROR_CODE')).toBe(
        'An unexpected error occurred. Please try again later.'
      );
    });

    it('should return generic message for undefined error code', () => {
      expect(getErrorMessage(undefined as any)).toBe(
        'An unexpected error occurred. Please try again later.'
      );
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error message with single parameter', () => {
      const message = formatErrorMessage(
        'The file {filename} could not be found.',
        { filename: 'app.js' }
      );
      expect(message).toBe('The file app.js could not be found.');
    });

    it('should format error message with multiple parameters', () => {
      const message = formatErrorMessage(
        'User {username} attempted to access project {projectId} without permission.',
        { username: 'john_doe', projectId: 'proj-123' }
      );
      expect(message).toBe(
        'User john_doe attempted to access project proj-123 without permission.'
      );
    });

    it('should handle missing parameters gracefully', () => {
      const message = formatErrorMessage(
        'The file {filename} could not be found.',
        {}
      );
      expect(message).toBe('The file {filename} could not be found.');
    });

    it('should handle extra parameters', () => {
      const message = formatErrorMessage(
        'Hello {name}!',
        { name: 'John', age: 30, city: 'New York' }
      );
      expect(message).toBe('Hello John!');
    });

    it('should handle numeric parameters', () => {
      const message = formatErrorMessage(
        'File size {size} exceeds limit of {limit} bytes.',
        { size: 1048576, limit: 524288 }
      );
      expect(message).toBe('File size 1048576 exceeds limit of 524288 bytes.');
    });

    it('should handle boolean parameters', () => {
      const message = formatErrorMessage(
        'Project visibility is set to {isPublic}.',
        { isPublic: true }
      );
      expect(message).toBe('Project visibility is set to true.');
    });

    it('should return original message if no parameters provided', () => {
      const originalMessage = 'This is a simple error message.';
      const message = formatErrorMessage(originalMessage);
      expect(message).toBe(originalMessage);
    });
  });

  describe('ErrorMessages constants', () => {
    it('should have all required authentication error messages', () => {
      expect(ErrorMessages.AUTH_INVALID_CREDENTIALS).toBeDefined();
      expect(ErrorMessages.AUTH_TOKEN_EXPIRED).toBeDefined();
      expect(ErrorMessages.AUTH_UNAUTHORIZED).toBeDefined();
      expect(ErrorMessages.AUTH_ACCOUNT_LOCKED).toBeDefined();
    });

    it('should have all required validation error messages', () => {
      expect(ErrorMessages.VALIDATION_REQUIRED_FIELD).toBeDefined();
      expect(ErrorMessages.VALIDATION_INVALID_EMAIL).toBeDefined();
      expect(ErrorMessages.VALIDATION_PASSWORD_TOO_SHORT).toBeDefined();
      expect(ErrorMessages.VALIDATION_INVALID_FORMAT).toBeDefined();
    });

    it('should have all required project error messages', () => {
      expect(ErrorMessages.PROJECT_NOT_FOUND).toBeDefined();
      expect(ErrorMessages.PROJECT_ACCESS_DENIED).toBeDefined();
      expect(ErrorMessages.PROJECT_NAME_EXISTS).toBeDefined();
      expect(ErrorMessages.PROJECT_LIMIT_EXCEEDED).toBeDefined();
    });

    it('should have all required file error messages', () => {
      expect(ErrorMessages.FILE_NOT_FOUND).toBeDefined();
      expect(ErrorMessages.FILE_TOO_LARGE).toBeDefined();
      expect(ErrorMessages.FILE_INVALID_TYPE).toBeDefined();
      expect(ErrorMessages.FILE_UPLOAD_FAILED).toBeDefined();
    });

    it('should have all required AI service error messages', () => {
      expect(ErrorMessages.AI_SERVICE_UNAVAILABLE).toBeDefined();
      expect(ErrorMessages.AI_QUOTA_EXCEEDED).toBeDefined();
      expect(ErrorMessages.AI_INVALID_PROMPT).toBeDefined();
      expect(ErrorMessages.AI_GENERATION_FAILED).toBeDefined();
    });

    it('should have generic error message', () => {
      expect(ErrorMessages.GENERIC_ERROR).toBeDefined();
    });
  });

  describe('error message consistency', () => {
    it('should have user-friendly messages', () => {
      const messages = Object.values(ErrorMessages);
      messages.forEach(message => {
        expect(message).not.toContain('null');
        expect(message).not.toContain('undefined');
        expect(message.length).toBeGreaterThan(10);
        expect(message.endsWith('.')).toBe(true);
      });
    });

    it('should not contain technical jargon in user-facing messages', () => {
      const technicalTerms = ['SQL', 'database', 'server', 'API', 'HTTP'];
      const userFacingMessages = [
        ErrorMessages.AUTH_INVALID_CREDENTIALS,
        ErrorMessages.VALIDATION_REQUIRED_FIELD,
        ErrorMessages.PROJECT_NOT_FOUND,
        ErrorMessages.FILE_TOO_LARGE,
      ];

      userFacingMessages.forEach(message => {
        technicalTerms.forEach(term => {
          expect(message.toLowerCase()).not.toContain(term.toLowerCase());
        });
      });
    });
  });
});