import { PerformanceMonitor } from '../../utils/performanceMonitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  describe('startTimer', () => {
    it('should start a timer for an operation', () => {
      const operationId = 'test-operation';
      
      performanceMonitor.startTimer(operationId);
      
      expect(performanceMonitor.hasActiveTimer(operationId)).toBe(true);
    });

    it('should handle multiple concurrent timers', () => {
      const operation1 = 'operation-1';
      const operation2 = 'operation-2';
      
      performanceMonitor.startTimer(operation1);
      performanceMonitor.startTimer(operation2);
      
      expect(performanceMonitor.hasActiveTimer(operation1)).toBe(true);
      expect(performanceMonitor.hasActiveTimer(operation2)).toBe(true);
    });
  });

  describe('endTimer', () => {
    it('should end a timer and return duration', async () => {
      const operationId = 'test-operation';
      
      performanceMonitor.startTimer(operationId);
      
      // Wait a small amount to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = performanceMonitor.endTimer(operationId);
      
      expect(duration).toBeGreaterThan(0);
      expect(performanceMonitor.hasActiveTimer(operationId)).toBe(false);
    });

    it('should return null for non-existent timer', () => {
      const duration = performanceMonitor.endTimer('non-existent');
      
      expect(duration).toBeNull();
    });
  });

  describe('measureAsync', () => {
    it('should measure async operation duration', async () => {
      const asyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await performanceMonitor.measureAsync(
        'async-test',
        asyncOperation
      );

      expect(result.result).toBe('result');
      expect(result.duration).toBeGreaterThan(40);
      expect(result.operationId).toBe('async-test');
    });

    it('should handle async operation errors', async () => {
      const errorOperation = async () => {
        throw new Error('Test error');
      };

      await expect(
        performanceMonitor.measureAsync('error-test', errorOperation)
      ).rejects.toThrow('Test error');
    });
  });

  describe('measureSync', () => {
    it('should measure synchronous operation duration', () => {
      const syncOperation = () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const result = performanceMonitor.measureSync('sync-test', syncOperation);

      expect(result.result).toBe(499500); // Sum of 0 to 999
      expect(result.duration).toBeGreaterThan(0);
      expect(result.operationId).toBe('sync-test');
    });

    it('should handle synchronous operation errors', () => {
      const errorOperation = () => {
        throw new Error('Sync error');
      };

      expect(() =>
        performanceMonitor.measureSync('sync-error-test', errorOperation)
      ).toThrow('Sync error');
    });
  });

  describe('getMetrics', () => {
    it('should return performance metrics', async () => {
      // Perform some operations
      await performanceMonitor.measureAsync('op1', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      performanceMonitor.measureSync('op2', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return sum;
      });

      const metrics = performanceMonitor.getMetrics();

      expect(metrics.totalOperations).toBe(2);
      expect(metrics.averageDuration).toBeGreaterThan(0);
      expect(metrics.operations).toHaveLength(2);
      expect(metrics.operations[0].operationId).toBe('op1');
      expect(metrics.operations[1].operationId).toBe('op2');
    });

    it('should return empty metrics when no operations recorded', () => {
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.totalOperations).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(metrics.operations).toHaveLength(0);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all recorded metrics', async () => {
      // Record some operations
      await performanceMonitor.measureAsync('op1', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(performanceMonitor.getMetrics().totalOperations).toBe(1);

      performanceMonitor.clearMetrics();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.operations).toHaveLength(0);
    });
  });

  describe('getSlowOperations', () => {
    it('should return operations slower than threshold', async () => {
      // Fast operation
      await performanceMonitor.measureAsync('fast-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      // Slow operation
      await performanceMonitor.measureAsync('slow-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
      });

      const slowOps = performanceMonitor.getSlowOperations(50);

      expect(slowOps).toHaveLength(1);
      expect(slowOps[0].operationId).toBe('slow-op');
      expect(slowOps[0].duration).toBeGreaterThan(50);
    });

    it('should return empty array when no slow operations', async () => {
      await performanceMonitor.measureAsync('fast-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      const slowOps = performanceMonitor.getSlowOperations(100);

      expect(slowOps).toHaveLength(0);
    });
  });

  describe('memory monitoring', () => {
    it('should track memory usage during operations', async () => {
      const result = await performanceMonitor.measureAsync(
        'memory-test',
        async () => {
          // Allocate some memory
          const largeArray = new Array(10000).fill('test');
          await new Promise(resolve => setTimeout(resolve, 10));
          return largeArray.length;
        }
      );

      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(result.memoryUsage.heapTotal).toBeGreaterThan(0);
    });
  });

  describe('operation categorization', () => {
    it('should categorize operations by type', async () => {
      await performanceMonitor.measureAsync('db:query', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await performanceMonitor.measureAsync('api:request', async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
      });

      await performanceMonitor.measureAsync('db:insert', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const dbOperations = performanceMonitor.getOperationsByCategory('db');
      const apiOperations = performanceMonitor.getOperationsByCategory('api');

      expect(dbOperations).toHaveLength(2);
      expect(apiOperations).toHaveLength(1);
    });
  });
});