import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth';
import { authService } from '../../services/AuthService';
import { userRepository } from '../../repositories';

// Mock dependencies
jest.mock('../../services/AuthService');
jest.mock('../../repositories/UserRepository');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUserResponse = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    createdAt: mockUser.createdAt.toISOString(),
    updatedAt: mockUser.updatedAt.toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'testpassword123'
    };

    it('should register user successfully', async () => {
      const token = 'jwt-token';
      mockAuthService.register.mockResolvedValue({ user: mockUser, token });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'User registered successfully',
        user: mockUserResponse,
        token
      });
      expect(mockAuthService.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegisterData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegisterData,
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should return 400 for invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegisterData,
          username: 'ab'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_USERNAME');
    });

    it('should return 409 for existing user', async () => {
      mockAuthService.register.mockRejectedValue(new Error('User with this email already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should return 500 for server error', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('REGISTRATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'testpassword123'
    };

    it('should login user successfully', async () => {
      const token = 'jwt-token';
      mockAuthService.login.mockResolvedValue({ user: mockUser, token });

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Login successful',
        user: mockUserResponse,
        token
      });
      expect(mockAuthService.login).toHaveBeenCalledWith(validLoginData);
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid email or password'));

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const token = 'valid-token';
      
      // Mock the token verification in middleware
      mockAuthService.verifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 401 for invalid token', async () => {
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile successfully', async () => {
      const token = 'valid-token';
      
      mockAuthService.verifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockUserResponse
      });
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 404 for non-existent user', async () => {
      const token = 'valid-token';
      
      mockAuthService.verifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      });
      mockUserRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });
});