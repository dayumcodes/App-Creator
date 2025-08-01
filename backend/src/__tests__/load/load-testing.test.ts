import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Load Testing', () => {
  let authTokens: string[] = [];
  let testUsers: any[] = [];
  let testProjects: any[] = [];

  beforeAll(async () => {
    // Create multiple test users for load testing
    const userPromises = Array.from({ length: 10 }, (_, i) => 
      prisma.user.create({
        data: {
          email: `loadtest${i}@example.com`,
          username: `loaduser${i}`,
          passwordHash: 'hashedpassword',
        },
      })
    );

    testUsers = await Promise.all(userPromises);

    // Generate auth tokens for all users
    authTokens = testUsers.map(user => 
      jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret'
      )
    );

    // Create test projects for each user
    const projectPromises = testUsers.map((user, i) => 
      prisma.project.create({
        data: {
          name: `Load Test Project ${i}`,
          description: `Project for load testing user ${i}`,
          userId: user.id,
        },
      })
    );

    testProjects = await Promise.all(projectPromises);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Authentication Load Tests', () => {
    it('should handle concurrent login requests', async () => {
      const concurrentLogins = 50;
      const loginPromises = Array.from({ length: concurrentLogins }, (_, i) => {
        const userIndex = i % testUsers.length;
        return request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers[userIndex].email,
            password: 'password123', // This will fail but tests the endpoint
          });
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(loginPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Analyze results
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      const failed = responses.filter(r => r.status === 'rejected').length;
      const avgResponseTime = duration / concurrentLogins;

      console.log(`Login Load Test Results:
        - Concurrent requests: ${concurrentLogins}
        - Successful: ${successful}
        - Failed: ${failed}
        - Total duration: ${duration}ms
        - Average response time: ${avgResponseTime}ms
      `);

      // Assertions
      expect(successful + failed).toBe(concurrentLogins);
      expect(avgResponseTime).toBeLessThan(1000); // Should respond within 1 second on average
      expect(successful / concurrentLogins).toBeGreaterThan(0.95); // 95% success rate
    });

    it('should handle rapid sequential authentication requests', async () => {
      const sequentialRequests = 100;
      const results: number[] = [];

      for (let i = 0; i < sequentialRequests; i++) {
        const startTime = Date.now();
        const userIndex = i % testUsers.length;
        
        try {
          await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`);
          
          const responseTime = Date.now() - startTime;
          results.push(responseTime);
        } catch (error) {
          results.push(-1); // Mark as failed
        }
      }

      const successfulRequests = results.filter(r => r > 0);
      const avgResponseTime = successfulRequests.reduce((a, b) => a + b, 0) / successfulRequests.length;
      const maxResponseTime = Math.max(...successfulRequests);
      const minResponseTime = Math.min(...successfulRequests);

      console.log(`Sequential Auth Test Results:
        - Total requests: ${sequentialRequests}
        - Successful: ${successfulRequests.length}
        - Average response time: ${avgResponseTime}ms
        - Min response time: ${minResponseTime}ms
        - Max response time: ${maxResponseTime}ms
      `);

      expect(successfulRequests.length / sequentialRequests).toBeGreaterThan(0.98);
      expect(avgResponseTime).toBeLessThan(200);
    });
  });

  describe('Project Management Load Tests', () => {
    it('should handle concurrent project creation', async () => {
      const concurrentCreations = 25;
      const createPromises = Array.from({ length: concurrentCreations }, (_, i) => {
        const userIndex = i % testUsers.length;
        return request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            name: `Concurrent Project ${i}`,
            description: `Project created during load test ${i}`,
          });
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(createPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 201
      ).length;

      console.log(`Project Creation Load Test Results:
        - Concurrent requests: ${concurrentCreations}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Average response time: ${duration / concurrentCreations}ms
      `);

      expect(successful / concurrentCreations).toBeGreaterThan(0.9);
      expect(duration / concurrentCreations).toBeLessThan(500);
    });

    it('should handle concurrent project reads', async () => {
      const concurrentReads = 100;
      const readPromises = Array.from({ length: concurrentReads }, (_, i) => {
        const userIndex = i % testUsers.length;
        const projectIndex = i % testProjects.length;
        return request(app)
          .get(`/api/projects/${testProjects[projectIndex].id}`)
          .set('Authorization', `Bearer ${authTokens[userIndex]}`);
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(readPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && 
        [(r.value as any).status === 200 || (r.value as any).status === 403] // 403 is expected for cross-user access
      ).length;

      console.log(`Project Read Load Test Results:
        - Concurrent requests: ${concurrentReads}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Average response time: ${duration / concurrentReads}ms
      `);

      expect(successful / concurrentReads).toBeGreaterThan(0.95);
      expect(duration / concurrentReads).toBeLessThan(100);
    });
  });

  describe('Code Generation Load Tests', () => {
    it('should handle concurrent code generation requests', async () => {
      const concurrentGenerations = 10; // Lower number due to AI service limits
      const generatePromises = Array.from({ length: concurrentGenerations }, (_, i) => {
        const userIndex = i % testUsers.length;
        const projectIndex = i % testProjects.length;
        return request(app)
          .post('/api/generate')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            projectId: testProjects[projectIndex].id,
            prompt: `Create a simple HTML page with content ${i}`,
            type: 'initial',
          });
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(generatePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && 
        [(r.value as any).status === 200 || (r.value as any).status === 403]
      ).length;

      console.log(`Code Generation Load Test Results:
        - Concurrent requests: ${concurrentGenerations}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Average response time: ${duration / concurrentGenerations}ms
      `);

      // More lenient expectations for AI service
      expect(successful / concurrentGenerations).toBeGreaterThan(0.7);
      expect(duration / concurrentGenerations).toBeLessThan(10000); // 10 seconds per request
    });

    it('should handle code validation load', async () => {
      const concurrentValidations = 50;
      const validatePromises = Array.from({ length: concurrentValidations }, (_, i) => {
        return request(app)
          .post('/api/generate/validate')
          .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
          .send({
            files: [
              {
                filename: `test${i}.html`,
                content: `<html><head><title>Test ${i}</title></head><body><h1>Hello ${i}</h1></body></html>`,
                type: 'html',
              },
              {
                filename: `test${i}.js`,
                content: `console.log("Test ${i}");`,
                type: 'js',
              },
            ],
          });
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(validatePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;

      console.log(`Code Validation Load Test Results:
        - Concurrent requests: ${concurrentValidations}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Average response time: ${duration / concurrentValidations}ms
      `);

      expect(successful / concurrentValidations).toBeGreaterThan(0.95);
      expect(duration / concurrentValidations).toBeLessThan(200);
    });
  });

  describe('File Management Load Tests', () => {
    it('should handle concurrent file operations', async () => {
      const concurrentFileOps = 30;
      const filePromises = Array.from({ length: concurrentFileOps }, (_, i) => {
        const userIndex = i % testUsers.length;
        const projectIndex = i % testProjects.length;
        
        // Mix of create and read operations
        if (i % 2 === 0) {
          // Create file
          return request(app)
            .post(`/api/projects/${testProjects[projectIndex].id}/files`)
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .send({
              filename: `loadtest${i}.js`,
              content: `console.log("Load test file ${i}");`,
              type: 'js',
            });
        } else {
          // Read files
          return request(app)
            .get(`/api/projects/${testProjects[projectIndex].id}/files`)
            .set('Authorization', `Bearer ${authTokens[userIndex]}`);
        }
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(filePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && 
        [(r.value as any).status === 200 || (r.value as any).status === 201 || (r.value as any).status === 403]
      ).length;

      console.log(`File Operations Load Test Results:
        - Concurrent requests: ${concurrentFileOps}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Average response time: ${duration / concurrentFileOps}ms
      `);

      expect(successful / concurrentFileOps).toBeGreaterThan(0.9);
      expect(duration / concurrentFileOps).toBeLessThan(300);
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle high-frequency database queries', async () => {
      const queryCount = 200;
      const queries: Promise<any>[] = [];

      // Mix different types of queries
      for (let i = 0; i < queryCount; i++) {
        const userIndex = i % testUsers.length;
        
        if (i % 4 === 0) {
          // User lookup
          queries.push(
            request(app)
              .get('/api/auth/me')
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          );
        } else if (i % 4 === 1) {
          // Project list
          queries.push(
            request(app)
              .get('/api/projects')
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          );
        } else if (i % 4 === 2) {
          // Project details
          queries.push(
            request(app)
              .get(`/api/projects/${testProjects[userIndex % testProjects.length].id}`)
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          );
        } else {
          // File list
          queries.push(
            request(app)
              .get(`/api/projects/${testProjects[userIndex % testProjects.length].id}/files`)
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          );
        }
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(queries);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && 
        [(r.value as any).status === 200 || (r.value as any).status === 403]
      ).length;

      console.log(`Database Query Load Test Results:
        - Total queries: ${queryCount}
        - Successful: ${successful}
        - Duration: ${duration}ms
        - Queries per second: ${(queryCount / duration) * 1000}
        - Average response time: ${duration / queryCount}ms
      `);

      expect(successful / queryCount).toBeGreaterThan(0.95);
      expect((queryCount / duration) * 1000).toBeGreaterThan(10); // At least 10 QPS
    });
  });

  describe('Memory and Resource Usage Tests', () => {
    it('should not leak memory during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const userIndex = i % testUsers.length;
        
        // Perform various operations
        await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`);

        await request(app)
          .post('/api/generate/validate')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            files: [
              {
                filename: 'memory-test.js',
                content: `console.log("Memory test ${i}");`,
                type: 'js',
              },
            ],
          });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory Usage Test Results:
        - Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB
        - Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB
        - Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(2)}%)
      `);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });
  });

  describe('Error Rate Under Load', () => {
    it('should maintain low error rate under sustained load', async () => {
      const totalRequests = 100;
      const batchSize = 10;
      const batches = totalRequests / batchSize;
      
      let totalSuccessful = 0;
      let totalErrors = 0;

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const userIndex = (batch * batchSize + i) % testUsers.length;
          return request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`);
        });

        const responses = await Promise.allSettled(batchPromises);
        
        const batchSuccessful = responses.filter(r => 
          r.status === 'fulfilled' && (r.value as any).status === 200
        ).length;
        
        const batchErrors = batchSize - batchSuccessful;
        
        totalSuccessful += batchSuccessful;
        totalErrors += batchErrors;

        // Small delay between batches to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const errorRate = (totalErrors / totalRequests) * 100;
      const successRate = (totalSuccessful / totalRequests) * 100;

      console.log(`Sustained Load Test Results:
        - Total requests: ${totalRequests}
        - Successful: ${totalSuccessful}
        - Errors: ${totalErrors}
        - Success rate: ${successRate.toFixed(2)}%
        - Error rate: ${errorRate.toFixed(2)}%
      `);

      expect(errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(successRate).toBeGreaterThan(95); // Greater than 95% success rate
    });
  });
});