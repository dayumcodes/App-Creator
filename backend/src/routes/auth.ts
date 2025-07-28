import { Router, Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { authenticateToken } from '../middleware/auth';
import { userRepository } from '../repositories';

const router = Router();

/**
 * User registration endpoint
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body;

    // Validate input
    if (!email || !username || !password) {
      res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, username, and password are required'
        }
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid email address'
        }
      });
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 6 characters long'
        }
      });
      return;
    }

    // Validate username
    if (username.length < 3 || username.length > 30) {
      res.status(400).json({
        error: {
          code: 'INVALID_USERNAME',
          message: 'Username must be between 3 and 30 characters'
        }
      });
      return;
    }

    const { user, token } = await authService.register({
      email,
      username,
      password
    });

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user;

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    
    if (message.includes('already exists') || message.includes('already taken')) {
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'REGISTRATION_ERROR',
        message
      }
    });
  }
});

/**
 * User login endpoint
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const { user, token } = await authService.login({ email, password });

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user;

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    
    res.status(401).json({
      error: {
        code: 'LOGIN_FAILED',
        message
      }
    });
  }
});

/**
 * User logout endpoint
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // For enhanced security, you could implement a token blacklist here
    
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Logout failed'
      }
    });
  }
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const user = await userRepository.findById(req.user.userId);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user;

    res.json({
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Failed to retrieve user profile'
      }
    });
  }
});

export default router;