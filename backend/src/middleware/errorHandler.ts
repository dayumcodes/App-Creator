import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error classes
export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

// Error handler middleware
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.statusCode || 500}: ${err.message}`, {
    error: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    details: err.details
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ConflictError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Invalid input data';
    error = new ValidationError(message, err.details);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AuthenticationError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AuthenticationError(message);
  }

  // Send error response
  const statusCode = error.statusCode || 500;
  const response: any = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error'
    }
  };

  // Include details in development
  if (process.env['NODE_ENV'] === 'development') {
    response.error.details = error.details;
    response.error.stack = error.stack;
  }

  // Include recovery suggestions
  response.error.suggestions = getRecoverySuggestions(error.code || 'INTERNAL_ERROR');

  res.status(statusCode).json(response);
};

// Get user-friendly recovery suggestions
function getRecoverySuggestions(errorCode: string): string[] {
  const suggestions: Record<string, string[]> = {
    VALIDATION_ERROR: [
      'Please check your input data and try again',
      'Ensure all required fields are filled',
      'Verify that data formats are correct'
    ],
    AUTHENTICATION_ERROR: [
      'Please log in again',
      'Check your credentials and try again',
      'Clear your browser cache and cookies'
    ],
    AUTHORIZATION_ERROR: [
      'Contact an administrator for access',
      'Ensure you have the necessary permissions',
      'Try logging out and logging back in'
    ],
    NOT_FOUND_ERROR: [
      'Check the URL and try again',
      'The resource may have been moved or deleted',
      'Go back to the previous page'
    ],
    CONFLICT_ERROR: [
      'The resource already exists',
      'Try using a different name or identifier',
      'Refresh the page and try again'
    ],
    RATE_LIMIT_ERROR: [
      'Please wait a moment before trying again',
      'Reduce the frequency of your requests',
      'Try again in a few minutes'
    ],
    EXTERNAL_SERVICE_ERROR: [
      'The external service is temporarily unavailable',
      'Please try again later',
      'Contact support if the problem persists'
    ],
    INTERNAL_ERROR: [
      'Please try again later',
      'Refresh the page',
      'Contact support if the problem persists'
    ]
  };

  return suggestions[errorCode] || suggestions['INTERNAL_ERROR'] || [
    'Please try again later',
    'Refresh the page',
    'Contact support if the problem persists'
  ];
}

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};