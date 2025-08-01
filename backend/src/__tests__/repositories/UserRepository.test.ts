import { UserRepository } from '../../repositories/UserRepository';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  })),
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    userRepository = new UserRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const userId = 'non-existent-user';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findById(userId);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-123',
        email,
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found by email', async () => {
      const email = 'nonexistent@example.com';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const username = 'testuser';
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByUsername(username);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        passwordHash: 'hashedpassword123',
      };
      const createdUser = {
        id: 'user-456',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userRepository.create(userData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData,
      });
      expect(result).toEqual(createdUser);
    });

    it('should handle creation errors', async () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'duplicate',
        passwordHash: 'hashedpassword123',
      };
      const error = new Error('Unique constraint violation');

      mockPrisma.user.create.mockRejectedValue(error);

      await expect(userRepository.create(userData)).rejects.toThrow(
        'Unique constraint violation'
      );
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const userId = 'user-123';
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com',
      };
      const updatedUser = {
        id: userId,
        ...updateData,
        passwordHash: 'hashedpassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.update(userId, updateData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should handle update errors', async () => {
      const userId = 'user-123';
      const updateData = { email: 'invalid-email' };
      const error = new Error('Validation error');

      mockPrisma.user.update.mockRejectedValue(error);

      await expect(userRepository.update(userId, updateData)).rejects.toThrow(
        'Validation error'
      );
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const userId = 'user-123';
      const deletedUser = {
        id: userId,
        email: 'deleted@example.com',
        username: 'deleteduser',
        passwordHash: 'hashedpassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.delete.mockResolvedValue(deletedUser);

      const result = await userRepository.delete(userId);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(deletedUser);
    });

    it('should handle delete errors', async () => {
      const userId = 'non-existent-user';
      const error = new Error('Record not found');

      mockPrisma.user.delete.mockRejectedValue(error);

      await expect(userRepository.delete(userId)).rejects.toThrow(
        'Record not found'
      );
    });
  });

  describe('findAll', () => {
    it('should find all users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          username: 'user1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          username: 'user2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userRepository.findAll({ page: 1, limit: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should handle pagination correctly', async () => {
      const mockUsers = [];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await userRepository.findAll({ page: 3, limit: 5 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 10, // (3-1) * 5
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('count', () => {
    it('should return total user count', async () => {
      const totalCount = 42;
      mockPrisma.user.count.mockResolvedValue(totalCount);

      const result = await userRepository.count();

      expect(mockPrisma.user.count).toHaveBeenCalled();
      expect(result).toBe(totalCount);
    });

    it('should return count with filters', async () => {
      const filteredCount = 15;
      const filters = { email: { contains: '@example.com' } };
      mockPrisma.user.count.mockResolvedValue(filteredCount);

      const result = await userRepository.count(filters);

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: filters,
      });
      expect(result).toBe(filteredCount);
    });
  });

  describe('search', () => {
    it('should search users by query', async () => {
      const query = 'john';
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          username: 'john_doe',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userRepository.search(query);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array for no matches', async () => {
      const query = 'nonexistent';
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await userRepository.search(query);

      expect(result).toEqual([]);
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login timestamp', async () => {
      const userId = 'user-123';
      const lastLoginTime = new Date();
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        lastLoginAt: lastLoginTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.updateLastLogin(userId, lastLoginTime);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { lastLoginAt: lastLoginTime },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});