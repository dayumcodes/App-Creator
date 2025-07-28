import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth } from '../../middleware/auth';
import { authService } from '../../services/AuthService';

// Mock dependencies
jest.mock('../../services/AuthService');

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const token = 'valid-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockAuthService.verifyToken.mockReturnValue(payload);

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 for missing authorization header', async () => {
      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for missing token in authorization header', async () => {
      mockRequest.headers = {
        authorization: 'Bearer'
      };

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      const token = 'invalid-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle token verification errors gracefully', async () => {
      const token = 'error-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token verification failed'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token when provided', async () => {
      const token = 'valid-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockAuthService.verifyToken.mockReturnValue(payload);

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(payload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token is invalid', async () => {
      const token = 'invalid-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});