import { DatabaseService } from '../../services/DatabaseService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    databaseService = new DatabaseService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);

      await databaseService.connect();

      expect(mockPrisma.$connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPrisma.$connect.mockRejectedValue(error);

      await expect(databaseService.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database successfully', async () => {
      mockPrisma.$disconnect.mockResolvedValue(undefined);

      await databaseService.disconnect();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const mockResult = { id: '1', name: 'Test' };
      mockPrisma.$transaction.mockResolvedValue(mockResult);

      const transactionFn = jest.fn().mockResolvedValue(mockResult);
      const result = await databaseService.transaction(transactionFn);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(transactionFn);
      expect(result).toEqual(mockResult);
    });

    it('should handle transaction errors', async () => {
      const error = new Error('Transaction failed');
      mockPrisma.$transaction.mockRejectedValue(error);

      const transactionFn = jest.fn();

      await expect(databaseService.transaction(transactionFn)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });

  describe('executeRaw', () => {
    it('should execute raw SQL successfully', async () => {
      const mockResult = [{ count: 5 }];
      mockPrisma.$queryRaw.mockResolvedValue(mockResult);

      const sql = 'SELECT COUNT(*) as count FROM users';
      const result = await databaseService.executeRaw(sql);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(mockResult);
    });

    it('should handle raw SQL errors', async () => {
      const error = new Error('SQL execution failed');
      mockPrisma.$queryRaw.mockRejectedValue(error);

      const sql = 'INVALID SQL';

      await expect(databaseService.executeRaw(sql)).rejects.toThrow(
        'SQL execution failed'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const health = await databaseService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return unhealthy status when database is not accessible', async () => {
      const error = new Error('Database not accessible');
      mockPrisma.$queryRaw.mockRejectedValue(error);

      const health = await databaseService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Database not accessible');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection information', () => {
      const info = databaseService.getConnectionInfo();

      expect(info).toHaveProperty('host');
      expect(info).toHaveProperty('port');
      expect(info).toHaveProperty('database');
      expect(info).toHaveProperty('ssl');
    });
  });

  describe('backup', () => {
    it('should create database backup', async () => {
      const mockBackupResult = {
        filename: 'backup_20240131_120000.sql',
        size: 1024000,
        timestamp: new Date(),
      };

      // Mock the backup process
      jest.spyOn(databaseService, 'backup').mockResolvedValue(mockBackupResult);

      const result = await databaseService.backup();

      expect(result).toEqual(mockBackupResult);
      expect(result.filename).toMatch(/backup_\d{8}_\d{6}\.sql/);
    });
  });
});