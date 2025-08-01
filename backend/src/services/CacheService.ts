import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performanceMonitor';

export class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache get');
      performanceMonitor.recordMetric({
        name: 'cache_miss',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        context: { key, reason: 'not_connected' }
      });
      return null;
    }

    const startTime = Date.now();
    try {
      const value = await this.client.get(key);
      const duration = Date.now() - startTime;
      
      performanceMonitor.recordMetric({
        name: 'cache_get_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { key }
      });

      if (value) {
        performanceMonitor.recordMetric({
          name: 'cache_hit',
          value: 1,
          unit: 'count',
          timestamp: new Date(),
          context: { key }
        });
        return JSON.parse(value);
      } else {
        performanceMonitor.recordMetric({
          name: 'cache_miss',
          value: 1,
          unit: 'count',
          timestamp: new Date(),
          context: { key, reason: 'not_found' }
        });
        return null;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric({
        name: 'cache_error',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        context: { key, operation: 'get', duration }
      });
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache set');
      return false;
    }

    const startTime = Date.now();
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric({
        name: 'cache_set_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { key, ttl: ttlSeconds, size: serialized.length }
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric({
        name: 'cache_error',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        context: { key, operation: 'set', duration }
      });
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache delete');
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache flush');
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  // Cache patterns for common operations
  async cacheUserProjects(userId: string, projects: any[], ttlSeconds: number = 300): Promise<void> {
    await this.set(`user:${userId}:projects`, projects, ttlSeconds);
  }

  async getUserProjectsFromCache(userId: string): Promise<any[] | null> {
    return await this.get<any[]>(`user:${userId}:projects`);
  }

  async cacheProject(projectId: string, project: any, ttlSeconds: number = 600): Promise<void> {
    await this.set(`project:${projectId}`, project, ttlSeconds);
  }

  async getProjectFromCache(projectId: string): Promise<any | null> {
    return await this.get<any>(`project:${projectId}`);
  }

  async cacheProjectFiles(projectId: string, files: any[], ttlSeconds: number = 300): Promise<void> {
    await this.set(`project:${projectId}:files`, files, ttlSeconds);
  }

  async getProjectFilesFromCache(projectId: string): Promise<any[] | null> {
    return await this.get<any[]>(`project:${projectId}:files`);
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `user:${userId}:projects`,
      `user:${userId}:profile`
    ];
    
    for (const key of keys) {
      await this.del(key);
    }
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    const keys = [
      `project:${projectId}`,
      `project:${projectId}:files`,
      `project:${projectId}:versions`
    ];
    
    for (const key of keys) {
      await this.del(key);
    }
  }
}

export const cacheService = new CacheService();