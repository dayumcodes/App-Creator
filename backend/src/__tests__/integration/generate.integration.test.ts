import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Code Generation Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
      },
    });
    userId = testUser.id;

    // Create test project
    const testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Project for generation testing',
        userId,
      },
    });
    projectId = testProject.id;

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/generate', () => {
    it('should generate code from prompt', async () => {
      const generateRequest = {
        projectId,
        prompt: 'Create a simple HTML page with a hello world message',
        type: 'initial',
      };

      const response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest)
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('promptId');

      // Verify files were created
      const files = await prisma.projectFile.findMany({
        where: { projectId },
      });
      expect(files.length).toBeGreaterThan(0);

      // Verify prompt history was saved
      const promptHistory = await prisma.promptHistory.findMany({
        where: { projectId },
      });
      expect(promptHistory.length).toBe(1);
      expect(promptHistory[0].prompt).toBe(generateRequest.prompt);
    });

    it('should handle iterative code generation', async () => {
      const iterateRequest = {
        projectId,
        prompt: 'Add a CSS file to style the page with a blue background',
        type: 'iterate',
      };

      const response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(iterateRequest)
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(response.body.files.some((file: any) => file.type === 'css')).toBe(true);

      // Verify additional files were created
      const files = await prisma.projectFile.findMany({
        where: { projectId },
      });
      expect(files.some(file => file.type === 'css')).toBe(true);
    });

    it('should return 400 for invalid prompt', async () => {
      const invalidRequest = {
        projectId,
        prompt: '', // Empty prompt
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 404 for non-existent project', async () => {
      const generateRequest = {
        projectId: 'non-existent-project',
        prompt: 'Create a simple page',
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      const generateRequest = {
        projectId,
        prompt: 'Create a simple page',
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .send(generateRequest)
        .expect(401);
    });

    it('should handle AI service errors gracefully', async () => {
      // Mock AI service to return error
      const generateRequest = {
        projectId,
        prompt: 'TRIGGER_AI_ERROR', // Special prompt to trigger error in mock
        type: 'initial',
      };

      const response = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/generate/validate', () => {
    it('should validate generated code', async () => {
      const validateRequest = {
        files: [
          {
            filename: 'index.html',
            content: '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
            type: 'html',
          },
          {
            filename: 'script.js',
            content: 'console.log("Hello World");',
            type: 'js',
          },
        ],
      };

      const response = await request(app)
        .post('/api/generate/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validateRequest)
        .expect(200);

      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('warnings');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(Array.isArray(response.body.warnings)).toBe(true);
    });

    it('should detect syntax errors in JavaScript', async () => {
      const validateRequest = {
        files: [
          {
            filename: 'invalid.js',
            content: 'const x = ; // Invalid syntax',
            type: 'js',
          },
        ],
      };

      const response = await request(app)
        .post('/api/generate/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validateRequest)
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should detect malformed HTML', async () => {
      const validateRequest = {
        files: [
          {
            filename: 'invalid.html',
            content: '<html><head><title>Test</head><body><h1>Unclosed tag</body></html>',
            type: 'html',
          },
        ],
      };

      const response = await request(app)
        .post('/api/generate/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validateRequest)
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid request format', async () => {
      const invalidRequest = {
        files: 'not-an-array',
      };

      await request(app)
        .post('/api/generate/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('GET /api/generate/history/:projectId', () => {
    it('should get prompt history for project', async () => {
      const response = await request(app)
        .get(`/api/generate/history/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('prompt');
      expect(response.body[0]).toHaveProperty('createdAt');
      expect(response.body[0]).toHaveProperty('filesChanged');
    });

    it('should support pagination for history', async () => {
      const response = await request(app)
        .get(`/api/generate/history/${projectId}?page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 404 for non-existent project', async () => {
      await request(app)
        .get('/api/generate/history/non-existent-project')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for unauthorized access', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          username: 'otheruser',
          passwordHash: 'hashedpassword',
        },
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get(`/api/generate/history/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/generate/suggestions', () => {
    it('should get prompt suggestions', async () => {
      const suggestionRequest = {
        context: 'html',
        partial: 'create a',
      };

      const response = await request(app)
        .post('/api/generate/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(suggestionRequest)
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should return context-aware suggestions', async () => {
      const suggestionRequest = {
        context: 'javascript',
        partial: 'function',
      };

      const response = await request(app)
        .post('/api/generate/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(suggestionRequest)
        .expect(200);

      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.suggestions.some((s: string) => 
        s.toLowerCase().includes('function')
      )).toBe(true);
    });

    it('should handle empty partial input', async () => {
      const suggestionRequest = {
        context: 'html',
        partial: '',
      };

      const response = await request(app)
        .post('/api/generate/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(suggestionRequest)
        .expect(200);

      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('Error handling and rate limiting', () => {
    it('should handle rate limiting for generation requests', async () => {
      const generateRequest = {
        projectId,
        prompt: 'Create a simple page',
        type: 'initial',
      };

      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateRequest)
      );

      const responses = await Promise.allSettled(requests);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequest = {
        // Missing required fields
        prompt: 'Create something',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(malformedRequest)
        .expect(400);
    });
  });
});