import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Authorization Security Tests', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let user1Project: any;
  let user2Project: any;

  beforeAll(async () => {
    // Clean up existing test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'authz-test' } }
    });

    // Create test users
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user1@authz-test.com',
        username: 'authzuser1',
        password: 'AuthzTest123!',
      });
    user1Token = user1Response.body.token;
    user1Id = user1Response.body.user.id;

    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user2@authz-test.com',
        username: 'authzuser2',
        password: 'AuthzTest123!',
      });
    user2Token = user2Response.body.token;
    user2Id = user2Response.body.user.id;

    // Create projects for each user
    const project1Response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'User 1 Project',
        description: 'Project owned by user 1',
      });
    user1Project = project1Response.body;

    const project2Response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        name: 'User 2 Project',
        description: 'Project owned by user 2',
      });
    user2Project = project2Response.body;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'authz-test' } }
    });
    await prisma.$disconnect();
  });

  describe('Project Access Control', () => {
    it('should allow users to access their own projects', async () => {
      // User 1 accessing their own project
      const response = await request(app)
        .get(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.id).toBe(user1Project.id);
      expect(response.body.userId).toBe(user1Id);
    });

    it('should deny access to other users projects', async () => {
      // User 2 trying to access User 1's project
      await request(app)
        .get(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      // User 1 trying to access User 2's project
      await request(app)
        .get(`/api/projects/${user2Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);
    });

    it('should prevent unauthorized project updates', async () => {
      const updateData = {
        name: 'Hacked Project Name',
        description: 'This should not be allowed',
      };

      // User 2 trying to update User 1's project
      await request(app)
        .put(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(updateData)
        .expect(403);

      // Verify project was not modified
      const response = await request(app)
        .get(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.name).toBe('User 1 Project');
      expect(response.body.description).toBe('Project owned by user 1');
    });

    it('should prevent unauthorized project deletion', async () => {
      // User 2 trying to delete User 1's project
      await request(app)
        .delete(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      // Verify project still exists
      await request(app)
        .get(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });

    it('should prevent unauthorized project export', async () => {
      // User 2 trying to export User 1's project
      await request(app)
        .post(`/api/projects/${user1Project.id}/export`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('File Access Control', () => {
    let user1File: any;

    beforeAll(async () => {
      // Create a file in User 1's project
      const fileResponse = await request(app)
        .post(`/api/projects/${user1Project.id}/files`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          filename: 'test.js',
          content: 'console.log("User 1 file");',
          type: 'js',
        });
      user1File = fileResponse.body;
    });

    it('should allow users to access files in their own projects', async () => {
      const response = await request(app)
        .get(`/api/projects/${user1Project.id}/files`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should deny access to files in other users projects', async () => {
      // User 2 trying to access files in User 1's project
      await request(app)
        .get(`/api/projects/${user1Project.id}/files`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should prevent unauthorized file creation', async () => {
      const fileData = {
        filename: 'malicious.js',
        content: 'console.log("This should not be created");',
        type: 'js',
      };

      // User 2 trying to create file in User 1's project
      await request(app)
        .post(`/api/projects/${user1Project.id}/files`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(fileData)
        .expect(403);
    });

    it('should prevent unauthorized file updates', async () => {
      const updateData = {
        content: 'console.log("Hacked content");',
      };

      // User 2 trying to update file in User 1's project
      await request(app)
        .put(`/api/projects/${user1Project.id}/files/${user1File.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(updateData)
        .expect(403);
    });

    it('should prevent unauthorized file deletion', async () => {
      // User 2 trying to delete file in User 1's project
      await request(app)
        .delete(`/api/projects/${user1Project.id}/files/${user1File.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Code Generation Access Control', () => {
    it('should allow users to generate code for their own projects', async () => {
      const generateRequest = {
        projectId: user1Project.id,
        prompt: 'Create a simple HTML page',
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(generateRequest)
        .expect(200);
    });

    it('should deny code generation for other users projects', async () => {
      const generateRequest = {
        projectId: user1Project.id,
        prompt: 'Create malicious code',
        type: 'initial',
      };

      // User 2 trying to generate code for User 1's project
      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${user2Token}`)
        .send(generateRequest)
        .expect(403);
    });

    it('should allow users to view their own prompt history', async () => {
      await request(app)
        .get(`/api/generate/history/${user1Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });

    it('should deny access to other users prompt history', async () => {
      // User 2 trying to access User 1's prompt history
      await request(app)
        .get(`/api/generate/history/${user1Project.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Token Manipulation Attacks', () => {
    it('should reject tokens with modified user IDs', async () => {
      // Decode user1's token and modify the user ID
      const decoded = jwt.decode(user1Token) as any;
      const tamperedToken = jwt.sign(
        { ...decoded, userId: user2Id },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access user1's project with tampered token
      await request(app)
        .get(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should reject tokens with additional privileges', async () => {
      // Create token with admin privileges
      const adminToken = jwt.sign(
        { userId: user1Id, email: 'user1@authz-test.com', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/projects',
        '/api/admin/system',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);

        // Should not grant admin access
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Resource Enumeration Prevention', () => {
    it('should not reveal existence of other users projects through error messages', async () => {
      // Generate a non-existent project ID
      const nonExistentId = 'non-existent-project-id';

      const response1 = await request(app)
        .get(`/api/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      const response2 = await request(app)
        .get(`/api/projects/${user2Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);

      // Error messages should not reveal whether the project exists
      expect(response1.body.error).not.toContain('exists');
      expect(response2.body.error).not.toContain('exists');
    });

    it('should prevent project ID enumeration', async () => {
      // Try to access projects with sequential IDs
      const testIds = [
        '1', '2', '3', '4', '5',
        'project-1', 'project-2', 'project-3',
      ];

      for (const id of testIds) {
        const response = await request(app)
          .get(`/api/projects/${id}`)
          .set('Authorization', `Bearer ${user1Token}`);

        // Should return consistent error responses
        expect([403, 404]).toContain(response.status);
        expect(response.body).not.toHaveProperty('userId');
        expect(response.body).not.toHaveProperty('owner');
      }
    });
  });

  describe('Horizontal Privilege Escalation Prevention', () => {
    it('should prevent users from listing other users projects', async () => {
      // Get user1's projects
      const user1Projects = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Get user2's projects
      const user2Projects = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Each user should only see their own projects
      expect(user1Projects.body.every((p: any) => p.userId === user1Id)).toBe(true);
      expect(user2Projects.body.every((p: any) => p.userId === user2Id)).toBe(true);

      // Users should not see each other's projects
      const user1ProjectIds = user1Projects.body.map((p: any) => p.id);
      const user2ProjectIds = user2Projects.body.map((p: any) => p.id);
      
      expect(user1ProjectIds).not.toContain(user2Project.id);
      expect(user2ProjectIds).not.toContain(user1Project.id);
    });

    it('should prevent access to user profiles of other users', async () => {
      // Try to access other user's profile information
      const profileEndpoints = [
        `/api/users/${user2Id}`,
        `/api/users/${user2Id}/profile`,
        `/api/users/${user2Id}/projects`,
      ];

      for (const endpoint of profileEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${user1Token}`);

        // Should deny access or return 404
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Mass Assignment Prevention', () => {
    it('should prevent unauthorized field updates in project modification', async () => {
      const maliciousUpdate = {
        name: 'Updated Name',
        description: 'Updated Description',
        userId: user2Id, // Trying to change ownership
        id: 'new-id', // Trying to change ID
        createdAt: new Date('2020-01-01'), // Trying to change creation date
      };

      const response = await request(app)
        .put(`/api/projects/${user1Project.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(maliciousUpdate)
        .expect(200);

      // Only allowed fields should be updated
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated Description');
      expect(response.body.userId).toBe(user1Id); // Should not change
      expect(response.body.id).toBe(user1Project.id); // Should not change
    });

    it('should prevent unauthorized field updates in user profile', async () => {
      const maliciousUpdate = {
        username: 'Updated Username',
        email: 'updated@authz-test.com',
        id: 'new-user-id', // Trying to change ID
        role: 'admin', // Trying to escalate privileges
        isVerified: true, // Trying to change verification status
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(maliciousUpdate);

      if (response.status === 200) {
        // Only allowed fields should be updated
        expect(response.body.id).toBe(user1Id); // Should not change
        expect(response.body).not.toHaveProperty('role');
        expect(response.body).not.toHaveProperty('isVerified');
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should implement rate limiting per user', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${user1Token}`)
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent resource exhaustion attacks', async () => {
      // Try to create many projects rapidly
      const createRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            name: `Spam Project ${i}`,
            description: 'Spam project for testing',
          })
      );

      const responses = await Promise.allSettled(createRequests);
      
      // Should have rate limiting or resource limits
      const successful = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 201
      ).length;

      // Should not allow unlimited project creation
      expect(successful).toBeLessThan(10);
    });
  });
});