import { AuthService } from '../../services/AuthService';
import { userRepository } from '../../repositories';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../repositories/UserRepository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;
  
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_EXPIRES_IN'] = '1h';
    
    authService = new AuthService();
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
    delete process.env['JWT_EXPIRES_IN'];
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'testpassword';
      const hashedPassword = 'hashed-password';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await authService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password against hash', async () => {
      const password = 'testpassword';
      const hash = 'hashed-password';
      
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await authService.verifyPassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'wrongpassword';
      const hash = 'hashed-password';
      
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await authService.verifyPassword(password, hash);

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token for user', () => {
      const token = 'jwt-token';
      
      mockJwt.sign.mockReturnValue(token as never);

      const result = authService.generateToken(mockUser);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        },
        'test-secret',
        {
          expiresIn: '1h',
          issuer: 'lovable-clone',
          audience: 'lovable-clone-users'
        }
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode valid token', () => {
      const token = 'valid-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      };
      
      mockJwt.verify.mockReturnValue(payload as never);

      const result = authService.verifyToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret', {
        issuer: 'lovable-clone',
        audience: 'lovable-clone-users'
      });
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';
      
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      expect(() => authService.verifyToken(token)).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      const token = 'expired-token';
      
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('token expired', new Date());
      });

      expect(() => authService.verifyToken(token)).toThrow('Token expired');
    });
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'testpassword'
    };

    it('should register new user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const token = 'jwt-token';
      
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValue(token as never);

      const result = await authService.register(registerData);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(registerData.username);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: registerData.email,
        username: registerData.username,
        passwordHash: hashedPassword
      });
      expect(result).toEqual({ user: mockUser, token });
    });

    it('should throw error if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should throw error if username already taken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.register(registerData)).rejects.toThrow(
        'Username already taken'
      );
    });
  });

  describe('login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'testpassword'
    };

    it('should login user successfully', async () => {
      const token = 'jwt-token';
      
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue(token as never);

      const result = await authService.login(loginCredentials);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginCredentials.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginCredentials.password, mockUser.passwordHash);
      expect(result).toEqual({ user: mockUser, token });
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for invalid password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('getUserByToken', () => {
    it('should return user for valid token', async () => {
      const token = 'valid-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      };
      
      mockJwt.verify.mockReturnValue(payload as never);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUserByToken(token);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(payload.userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      const token = 'valid-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      };
      
      mockJwt.verify.mockReturnValue(payload as never);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.getUserByToken(token)).rejects.toThrow('User not found');
    });
  });
});