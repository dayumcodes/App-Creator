import { CacheService } from '../../services/CacheService';
import Redis from 'redis';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      flushall: jest.fn(),
      on: jest.fn(),
    };
    (Redis.createClient as jest.Mock).mockReturnValue(mockRedisClient);
    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await cacheService.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(cacheService.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('get', () => {
    it('should retrieve value from cache', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisClient.get.mockResolvedValue(value);

      const result = await cacheService.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(value);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent-key';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in cache with TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 3600;
      mockRedisClient.set.mockResolvedValue('OK');

      await cacheService.set(key, value, ttl);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
    });

    it('should set value in cache without TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisClient.set.mockResolvedValue('OK');

      await cacheService.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      const key = 'test-key';
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cacheService.delete(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const key = 'non-existent-key';
      mockRedisClient.del.mockResolvedValue(0);

      const result = await cacheService.delete(key);

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      const key = 'test-key';
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cacheService.exists(key);

      expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const key = 'non-existent-key';
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await cacheService.exists(key);

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      mockRedisClient.flushall.mockResolvedValue('OK');

      await cacheService.clear();

      expect(mockRedisClient.flushall).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      mockRedisClient.disconnect.mockResolvedValue(undefined);

      await cacheService.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});