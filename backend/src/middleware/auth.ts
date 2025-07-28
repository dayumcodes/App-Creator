import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload } from '../services/AuthService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      return;
    }

    // Verify token
    const payload = authService.verifyToken(token);
    req.user = payload;
    
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message
      }
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.verifyToken(token);
      req.user = payload;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};