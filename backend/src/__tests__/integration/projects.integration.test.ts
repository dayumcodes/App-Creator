import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Projects Integration Tests', () => {
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

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.description).toBe(projectData.description);
      expect(response.body.userId).toBe(userId);

      projectId = response.body.id;
    });

    it('should return 400 for invalid project data', async () => {
      const invalidData = {
        name: '', // Empty name should be invalid
        description: 'Valid description',
      };

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const projectData = {
        name: 'Unauthorized Project',
        description: 'This should fail',
      };

      await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should get user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('description');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/projects?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get specific project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('files');
    });

    it('should return 404 for non-existent project', async () => {
      const nonExistentId = 'non-existent-id';

      await request(app)
        .get(`/api/projects/${nonExistentId}`)
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
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      const updateData = {
        name: 'Updated Test Project',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        name: '', // Empty name should be invalid
      };

      await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 404 for non-existent project', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      await request(app)
        .put('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify project is deleted
      await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent project', async () => {
      await request(app)
        .delete('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/projects/:id/export', () => {
    let exportProjectId: string;

    beforeEach(async () => {
      // Create a project with files for export testing
      const project = await prisma.project.create({
        data: {
          name: 'Export Test Project',
          description: 'Project for export testing',
          userId,
        },
      });
      exportProjectId = project.id;

      // Add some files
      await prisma.projectFile.createMany({
        data: [
          {
            projectId: exportProjectId,
            filename: 'index.html',
            content: '<html><body>Hello World</body></html>',
            type: 'html',
          },
          {
            projectId: exportProjectId,
            filename: 'style.css',
            content: 'body { margin: 0; }',
            type: 'css',
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.projectFile.deleteMany({ where: { projectId: exportProjectId } });
      await prisma.project.delete({ where: { id: exportProjectId } });
    });

    it('should export project as ZIP', async () => {
      const response = await request(app)
        .post(`/api/projects/${exportProjectId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      await request(app)
        .post('/api/projects/non-existent-id/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Project Files API', () => {
    let fileProjectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          name: 'File Test Project',
          description: 'Project for file testing',
          userId,
        },
      });
      fileProjectId = project.id;
    });

    afterEach(async () => {
      await prisma.projectFile.deleteMany({ where: { projectId: fileProjectId } });
      await prisma.project.delete({ where: { id: fileProjectId } });
    });

    describe('GET /api/projects/:id/files', () => {
      it('should get project files', async () => {
        // Create test files
        await prisma.projectFile.createMany({
          data: [
            {
              projectId: fileProjectId,
              filename: 'index.html',
              content: '<html></html>',
              type: 'html',
            },
            {
              projectId: fileProjectId,
              filename: 'app.js',
              content: 'console.log("hello");',
              type: 'js',
            },
          ],
        });

        const response = await request(app)
          .get(`/api/projects/${fileProjectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        expect(response.body[0]).toHaveProperty('filename');
        expect(response.body[0]).toHaveProperty('content');
        expect(response.body[0]).toHaveProperty('type');
      });
    });

    describe('POST /api/projects/:id/files', () => {
      it('should create new file', async () => {
        const fileData = {
          filename: 'new-file.js',
          content: 'const x = 5;',
          type: 'js',
        };

        const response = await request(app)
          .post(`/api/projects/${fileProjectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(fileData)
          .expect(201);

        expect(response.body.filename).toBe(fileData.filename);
        expect(response.body.content).toBe(fileData.content);
        expect(response.body.type).toBe(fileData.type);
      });

      it('should return 400 for invalid file data', async () => {
        const invalidData = {
          filename: '', // Empty filename
          content: 'valid content',
          type: 'js',
        };

        await request(app)
          .post(`/api/projects/${fileProjectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
      });
    });
  });
});