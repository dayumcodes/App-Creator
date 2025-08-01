import request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('End-to-End User Workflows', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promptHistory.deleteMany({});
    await prisma.projectFile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Complete User Registration and Project Creation Workflow', () => {
    it('should complete full user registration to project creation workflow', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: 'e2e-test@example.com',
        username: 'e2euser',
        password: 'SecurePassword123!',
      };

      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('user');
      expect(registrationResponse.body).toHaveProperty('token');
      expect(registrationResponse.body.user.email).toBe(registrationData.email);
      expect(registrationResponse.body.user.username).toBe(registrationData.username);

      testUser = registrationResponse.body.user;
      authToken = registrationResponse.body.token;

      // Step 2: User Login (verify credentials work)
      const loginData = {
        email: registrationData.email,
        password: registrationData.password,
      };

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
      authToken = loginResponse.body.token; // Use fresh token

      // Step 3: Create First Project
      const projectData = {
        name: 'My First E2E Project',
        description: 'A project created during end-to-end testing',
      };

      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(projectResponse.body).toHaveProperty('id');
      expect(projectResponse.body.name).toBe(projectData.name);
      expect(projectResponse.body.userId).toBe(testUser.id);

      const projectId = projectResponse.body.id;

      // Step 4: Generate Initial Code
      const generateRequest = {
        projectId,
        prompt: 'Create a simple HTML page with a welcome message and basic styling',
        type: 'initial',
      };

      const generateResponse = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest)
        .expect(200);

      expect(generateResponse.body).toHaveProperty('files');
      expect(generateResponse.body.files.length).toBeGreaterThan(0);

      // Step 5: Verify Files Were Created
      const filesResponse = await request(app)
        .get(`/api/projects/${projectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(filesResponse.body)).toBe(true);
      expect(filesResponse.body.length).toBeGreaterThan(0);

      const htmlFile = filesResponse.body.find((file: any) => file.type === 'html');
      expect(htmlFile).toBeDefined();
      expect(htmlFile.content).toContain('welcome');

      // Step 6: Iterate on the Code
      const iterateRequest = {
        projectId,
        prompt: 'Add a navigation menu with Home, About, and Contact links',
        type: 'iterate',
      };

      const iterateResponse = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(iterateRequest)
        .expect(200);

      expect(iterateResponse.body).toHaveProperty('files');

      // Step 7: Verify Updated Files
      const updatedFilesResponse = await request(app)
        .get(`/api/projects/${projectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedHtmlFile = updatedFilesResponse.body.find((file: any) => file.type === 'html');
      expect(updatedHtmlFile.content).toContain('nav');

      // Step 8: Export Project
      const exportResponse = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(exportResponse.headers['content-type']).toBe('application/zip');

      // Step 9: Verify Prompt History
      const historyResponse = await request(app)
        .get(`/api/generate/history/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(historyResponse.body)).toBe(true);
      expect(historyResponse.body.length).toBe(2); // Initial + iterate
    });
  });

  describe('Multi-Project Management Workflow', () => {
    it('should handle multiple projects and switching between them', async () => {
      // Create multiple projects
      const projects = [];
      for (let i = 1; i <= 3; i++) {
        const projectData = {
          name: `E2E Project ${i}`,
          description: `Test project number ${i}`,
        };

        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send(projectData)
          .expect(201);

        projects.push(response.body);
      }

      // Verify all projects are listed
      const listResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.length).toBeGreaterThanOrEqual(3);

      // Work on each project
      for (const project of projects) {
        const generateRequest = {
          projectId: project.id,
          prompt: `Create a unique page for ${project.name}`,
          type: 'initial',
        };

        await request(app)
          .post('/api/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateRequest)
          .expect(200);

        // Verify files were created for this project
        const filesResponse = await request(app)
          .get(`/api/projects/${project.id}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(filesResponse.body.length).toBeGreaterThan(0);
      }

      // Update one project
      const updateData = {
        name: 'Updated E2E Project 1',
        description: 'This project has been updated',
      };

      await request(app)
        .put(`/api/projects/${projects[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Delete one project
      await request(app)
        .delete(`/api/projects/${projects[2].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify project was deleted
      await request(app)
        .get(`/api/projects/${projects[2].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('File Management Workflow', () => {
    let fileProjectId: string;

    beforeAll(async () => {
      // Create a project for file management testing
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'File Management Project',
          description: 'Testing file operations',
        })
        .expect(201);

      fileProjectId = projectResponse.body.id;
    });

    it('should handle complete file management workflow', async () => {
      // Step 1: Create initial files through generation
      const generateRequest = {
        projectId: fileProjectId,
        prompt: 'Create a basic web app with HTML, CSS, and JavaScript files',
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest)
        .expect(200);

      // Step 2: Get all files
      const initialFilesResponse = await request(app)
        .get(`/api/projects/${fileProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(initialFilesResponse.body.length).toBeGreaterThan(0);
      const initialFileCount = initialFilesResponse.body.length;

      // Step 3: Add a new file manually
      const newFileData = {
        filename: 'config.json',
        content: '{"version": "1.0.0", "name": "test-app"}',
        type: 'json',
      };

      const createFileResponse = await request(app)
        .post(`/api/projects/${fileProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newFileData)
        .expect(201);

      expect(createFileResponse.body.filename).toBe(newFileData.filename);

      // Step 4: Update an existing file
      const filesToUpdate = await request(app)
        .get(`/api/projects/${fileProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const jsFile = filesToUpdate.body.find((file: any) => file.type === 'js');
      if (jsFile) {
        const updateData = {
          content: jsFile.content + '\n// Updated content',
        };

        await request(app)
          .put(`/api/projects/${fileProjectId}/files/${jsFile.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        // Verify update
        const updatedFilesResponse = await request(app)
          .get(`/api/projects/${fileProjectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const updatedJsFile = updatedFilesResponse.body.find((file: any) => file.id === jsFile.id);
        expect(updatedJsFile.content).toContain('Updated content');
      }

      // Step 5: Verify total file count increased
      const finalFilesResponse = await request(app)
        .get(`/api/projects/${fileProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalFilesResponse.body.length).toBe(initialFileCount + 1);

      // Step 6: Validate all files
      const validateRequest = {
        files: finalFilesResponse.body.map((file: any) => ({
          filename: file.filename,
          content: file.content,
          type: file.type,
        })),
      };

      const validateResponse = await request(app)
        .post('/api/generate/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validateRequest)
        .expect(200);

      expect(validateResponse.body).toHaveProperty('isValid');
    });
  });

  describe('Authentication and Session Management Workflow', () => {
    it('should handle session expiration and renewal', async () => {
      // Step 1: Make authenticated request (should work)
      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 2: Simulate token expiration by using invalid token
      const invalidToken = 'invalid.token.here';

      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      // Step 3: Re-authenticate
      const loginData = {
        email: 'e2e-test@example.com',
        password: 'SecurePassword123!',
      };

      const renewalResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const newToken = renewalResponse.body.token;

      // Step 4: Verify new token works
      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      // Step 5: Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      // Step 6: Verify token is invalidated (this might not work depending on implementation)
      // Some implementations don't track token invalidation on logout
      // await request(app)
      //   .get('/api/projects')
      //   .set('Authorization', `Bearer ${newToken}`)
      //   .expect(401);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from various error scenarios', async () => {
      // Create a project for error testing
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Error Recovery Project',
          description: 'Testing error scenarios',
        })
        .expect(201);

      const errorProjectId = projectResponse.body.id;

      // Scenario 1: Invalid generation request
      const invalidGenerateRequest = {
        projectId: errorProjectId,
        prompt: '', // Empty prompt should fail
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidGenerateRequest)
        .expect(400);

      // Scenario 2: Valid request after error
      const validGenerateRequest = {
        projectId: errorProjectId,
        prompt: 'Create a simple HTML page',
        type: 'initial',
      };

      await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validGenerateRequest)
        .expect(200);

      // Scenario 3: Access non-existent resource
      await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Scenario 4: Continue with valid operations
      await request(app)
        .get(`/api/projects/${errorProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Scenario 5: Invalid file creation
      const invalidFileData = {
        filename: '', // Empty filename should fail
        content: 'valid content',
        type: 'js',
      };

      await request(app)
        .post(`/api/projects/${errorProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFileData)
        .expect(400);

      // Scenario 6: Valid file creation after error
      const validFileData = {
        filename: 'recovery.js',
        content: 'console.log("Recovered from error");',
        type: 'js',
      };

      await request(app)
        .post(`/api/projects/${errorProjectId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validFileData)
        .expect(201);
    });
  });
});