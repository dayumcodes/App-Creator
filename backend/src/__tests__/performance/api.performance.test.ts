import request from 'supertest';
import app from '../../index';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { databaseService } from '../../services/DatabaseService';

describe('API Performance Tests', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    await databaseService.connect();
    
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'perf-test@example.com',
        username: 'perftest',
        password: 'password123'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'perf-test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Performance Test Project',
        description: 'Project for performance testing'
      });

    projectId = projectResponse.body.id;
  });

  afterAll(async () => {
    await databaseService.disconnect();
  });

  describe('Authentication Performance', () => {
    test('should handle concurrent login requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'perf-test@example.com',
            password: 'password123'
          })
      );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      // Performance assertions
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 concurrent requests
      const avgResponseTime = duration / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100); // Average <100ms per request

      console.log(`Authentication Performance:
        - ${concurrentRequests} concurrent login requests: ${duration}ms
        - Average response time: ${avgResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Project API Performance', () => {
    test('should handle project listing with pagination efficiently', async () => {
      // Create multiple projects for testing
      const projectCount = 20;
      const createPromises = Array.from({ length: projectCount }, (_, i) =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Performance Project ${i}`,
            description: `Test project ${i} for performance testing`
          })
      );

      await Promise.all(createPromises);

      // Test paginated listing performance
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/projects?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(10);
      expect(response.body.total).toBeGreaterThanOrEqual(projectCount);
      expect(duration).toBeLessThan(1000); // Should complete in <1 second

      console.log(`Project Listing Performance:
        - Paginated listing (10 items): ${duration}ms
        - Total projects: ${response.body.total}`);
    });

    test('should handle concurrent project operations efficiently', async () => {
      const concurrentOperations = 20;
      const startTime = Date.now();

      // Mix of read and write operations
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        if (i % 3 === 0) {
          // Create operation
          return request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Concurrent Project ${i}`,
              description: `Concurrent test project ${i}`
            });
        } else if (i % 3 === 1) {
          // Read operation
          return request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${authToken}`);
        } else {
          // Update operation
          return request(app)
            .put(`/api/projects/${projectId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              name: `Updated Project ${i}`,
              description: `Updated description ${i}`
            });
        }
      });

      const responses = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThanOrEqual(201);
      });

      expect(duration).toBeLessThan(10000); // 10 seconds for mixed operations

      console.log(`Concurrent Project Operations Performance:
        - ${concurrentOperations} mixed operations: ${duration}ms
        - Average time per operation: ${(duration / concurrentOperations).toFixed(2)}ms`);
    });
  });

  describe('Code Generation Performance', () => {
    test('should handle code generation requests within acceptable time limits', async () => {
      const prompts = [
        'Create a simple HTML page with a header',
        'Add CSS styling to make it responsive',
        'Add JavaScript for interactive buttons',
        'Create a contact form with validation',
        'Add a navigation menu'
      ];

      const results = [];
      
      for (const prompt of prompts) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            prompt,
            context: 'performance test'
          });
        
        const duration = Date.now() - startTime;
        
        expect(response.status).toBeLessThanOrEqual(201);
        expect(duration).toBeLessThan(30000); // 30 seconds max per generation
        
        results.push({ prompt, duration, status: response.status });
      }

      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      const avgDuration = totalDuration / results.length;

      console.log(`Code Generation Performance:
        - ${prompts.length} generation requests: ${totalDuration}ms
        - Average generation time: ${avgDuration.toFixed(2)}ms
        - Results:`, results.map(r => `${r.duration}ms`).join(', '));
    });
  });

  describe('Database Query Performance', () => {
    test('should maintain efficient database query performance', async () => {
      const queryCount = 100;
      const startTime = Date.now();

      // Simulate multiple database queries through API calls
      const queries = Array.from({ length: queryCount }, () =>
        request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(queries);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(projectId);
      });

      const avgQueryTime = duration / queryCount;
      expect(avgQueryTime).toBeLessThan(50); // Average <50ms per query

      console.log(`Database Query Performance:
        - ${queryCount} project queries: ${duration}ms
        - Average query time: ${avgQueryTime.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate high load
      const loadRequests = 200;
      const requests = Array.from({ length: loadRequests }, (_, i) => {
        const operations = [
          () => request(app).get('/api/projects').set('Authorization', `Bearer ${authToken}`),
          () => request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${authToken}`),
          () => request(app).get('/health')
        ];
        
        return operations[i % operations.length]();
      });

      const startTime = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - startTime;

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory Usage Under Load:
        - ${loadRequests} requests completed in: ${duration}ms
        - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)
        - RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should collect performance metrics during API operations', async () => {
      const initialMetrics = performanceMonitor.getMetrics('api_response_time', 10);
      
      // Make several API calls to generate metrics
      await Promise.all([
        request(app).get('/api/projects').set('Authorization', `Bearer ${authToken}`),
        request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${authToken}`),
        request(app).get('/health'),
        request(app).get('/api/performance/dashboard').set('Authorization', `Bearer ${authToken}`)
      ]);

      const finalMetrics = performanceMonitor.getMetrics('api_response_time', 20);
      const newMetrics = finalMetrics.length - initialMetrics.length;

      expect(newMetrics).toBeGreaterThan(0);
      
      // Check that metrics are being recorded with reasonable values
      const recentMetrics = finalMetrics.slice(-newMetrics);
      recentMetrics.forEach(metric => {
        expect(metric.value).toBeGreaterThan(0);
        expect(metric.value).toBeLessThan(5000); // Should be less than 5 seconds
        expect(metric.unit).toBe('ms');
        expect(metric.context).toBeDefined();
      });

      console.log(`Performance Metrics Collection:
        - New metrics recorded: ${newMetrics}
        - Recent response times: ${recentMetrics.map(m => `${m.value}ms`).join(', ')}`);
    });
  });
});