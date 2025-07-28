import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../types/database';
import { userRepository } from '../repositories';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  username: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export class AuthService {
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    this.jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
    
    if (!process.env['JWT_SECRET']) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using default secret.');
    }
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'lovable-clone',
      audience: 'lovable-clone-users'
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'lovable-clone',
        audience: 'lovable-clone-users'
      }) as AuthTokenPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const user = await userRepository.create({
      email: data.email,
      username: data.username,
      passwordHash
    });

    // Generate token
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Login a user
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    // Find user by email
    const user = await userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Get user by token
   */
  async getUserByToken(token: string): Promise<User> {
    const payload = this.verifyToken(token);
    const user = await userRepository.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();