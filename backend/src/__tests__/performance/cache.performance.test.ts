import { CacheService } from '../../services/CacheService';
import { performanceMonitor } from '../../utils/performanceMonitor';

describe('Cache Performance Tests', () => {
  let cacheService: CacheService;
  
  beforeAll(async () => {
    cacheService = new CacheService();
    await cacheService.connect();
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  beforeEach(async () => {
    await cacheService.flush();
  });

  describe('Cache Operations Performance', () => {
    test('should handle high-volume cache operations efficiently', async () => {
      const operations = 1000;
      const startTime = Date.now();
      
      // Parallel set operations
      const setPromises = Array.from({ length: operations }, (_, i) => 
        cacheService.set(`test-key-${i}`, { data: `test-data-${i}`, index: i })
      );
      
      await Promise.all(setPromises);
      const setDuration = Date.now() - startTime;
      
      // Parallel get operations
      const getStartTime = Date.now();
      const getPromises = Array.from({ length: operations }, (_, i) => 
        cacheService.get(`test-key-${i}`)
      );
      
      const results = await Promise.all(getPromises);
      const getDuration = Date.now() - getStartTime;
      
      // Assertions
      expect(results).toHaveLength(operations);
      expect(results.every(result => result !== null)).toBe(true);
      
      // Performance assertions (adjust thresholds based on your requirements)
      expect(setDuration).toBeLessThan(5000); // 5 seconds for 1000 operations
      expect(getDuration).toBeLessThan(2000); // 2 seconds for 1000 operations
      
      console.log(`Cache Performance:
        - Set ${operations} items: ${setDuration}ms (${(setDuration/operations).toFixed(2)}ms per operation)
        - Get ${operations} items: ${getDuration}ms (${(getDuration/operations).toFixed(2)}ms per operation)`);
    });

    test('should maintain performance with large data objects', async () => {
      const largeObject = {
        id: 'test-large-object',
        data: Array.from({ length: 10000 }, (_, i) => ({
          index: i,
          value: `large-data-value-${i}`,
          timestamp: new Date().toISOString(),
          metadata: {
            type: 'performance-test',
            size: 'large',
            nested: {
              level1: { level2: { level3: `deep-value-${i}` } }
            }
          }
        }))
      };

      const startTime = Date.now();
      
      // Set large object
      await cacheService.set('large-object', largeObject);
      const setDuration = Date.now() - startTime;
      
      // Get large object
      const getStartTime = Date.now();
      const retrieved = await cacheService.get('large-object');
      const getDuration = Date.now() - getStartTime;
      
      expect(retrieved).toEqual(largeObject);
      expect(setDuration).toBeLessThan(1000); // 1 second
      expect(getDuration).toBeLessThan(500); // 0.5 seconds
      
      console.log(`Large Object Performance:
        - Set large object: ${setDuration}ms
        - Get large object: ${getDuration}ms
        - Object size: ~${JSON.stringify(largeObject).length} characters`);
    });

    test('should handle concurrent cache operations without conflicts', async () => {
      const concurrentOperations = 100;
      const startTime = Date.now();
      
      // Mix of concurrent operations
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        const key = `concurrent-key-${i}`;
        const value = { index: i, timestamp: Date.now() };
        
        return Promise.all([
          cacheService.set(key, value),
          cacheService.get(key),
          cacheService.exists(key)
        ]);
      });
      
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(concurrentOperations);
      expect(duration).toBeLessThan(3000); // 3 seconds
      
      console.log(`Concurrent Operations Performance:
        - ${concurrentOperations * 3} concurrent operations: ${duration}ms`);
    });
  });

  describe('Cache Hit Rate Performance', () => {
    test('should achieve high cache hit rates under load', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `hit-rate-key-${i}`);
      const values = keys.map((key, i) => ({ key, data: `data-${i}` }));
      
      // Populate cache
      await Promise.all(
        keys.map((key, i) => cacheService.set(key, values[i]))
      );
      
      // Simulate realistic access pattern (80% hits, 20% misses)
      const accessPattern = Array.from({ length: 1000 }, () => {
        if (Math.random() < 0.8) {
          // 80% chance of hitting existing key
          return keys[Math.floor(Math.random() * keys.length)];
        } else {
          // 20% chance of missing key
          return `miss-key-${Math.random()}`;
        }
      });
      
      const startTime = Date.now();
      const results = await Promise.all(
        accessPattern.map(key => cacheService.get(key))
      );
      const duration = Date.now() - startTime;
      
      const hits = results.filter(result => result !== null).length;
      const hitRate = (hits / results.length) * 100;
      
      expect(hitRate).toBeGreaterThan(75); // Should achieve >75% hit rate
      expect(duration).toBeLessThan(2000); // Should complete in <2 seconds
      
      console.log(`Cache Hit Rate Performance:
        - Total requests: ${results.length}
        - Cache hits: ${hits}
        - Hit rate: ${hitRate.toFixed(2)}%
        - Duration: ${duration}ms`);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should manage memory efficiently with cache operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive cache operations
      const operations = 500;
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `large-string-data-${i}`.repeat(100)
      }));
      
      // Set operations
      await Promise.all(
        Array.from({ length: operations }, (_, i) => 
          cacheService.set(`memory-test-${i}`, largeData)
        )
      );
      
      const afterSetMemory = process.memoryUsage();
      
      // Get operations
      await Promise.all(
        Array.from({ length: operations }, (_, i) => 
          cacheService.get(`memory-test-${i}`)
        )
      );
      
      const afterGetMemory = process.memoryUsage();
      
      // Cleanup
      await Promise.all(
        Array.from({ length: operations }, (_, i) => 
          cacheService.del(`memory-test-${i}`)
        )
      );
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = afterSetMemory.heapUsed - initialMemory.heapUsed;
      const memoryAfterCleanup = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory Usage Performance:
        - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - After set operations: ${(afterSetMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - After get operations: ${(afterGetMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - After cleanup: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB
        - Memory after cleanup: ${(memoryAfterCleanup / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory should not increase excessively after cleanup
      expect(memoryAfterCleanup).toBeLessThan(memoryIncrease * 0.5);
    });
  });
});