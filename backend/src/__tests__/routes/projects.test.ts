import request from 'supertest';
import app from '../../index';
import { databaseService } from '../../services/DatabaseService';
import { authService } from '../../services/AuthService';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { ProjectFileRepository } from '../../repositories/ProjectFileRepository';
import { UserRepository } from '../../repositories/UserRepository';

describe('Project Routes', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let otherUserId: string;
  let otherUserToken: string;

  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const projectFileRepository = new ProjectFileRepository();

  beforeAll(async () => {
    await databaseService.connect();
    
    // Create test user with unique email
    const timestamp = Date.now();
    const testUser = await userRepository.create({
      email: `test-${timestamp}@example.com`,
      username: `testuser-${timestamp}`,
      passwordHash: 'hashedpassword123'
    });
    userId = testUser.id;
    authToken = authService.generateToken(testUser);

    // Create another test user for ownership validation tests
    const otherUser = await userRepository.create({
      email: `other-${timestamp}@example.com`,
      username: `otheruser-${timestamp}`,
      passwordHash: 'hashedpassword456'
    });
    otherUserId = otherUser.id;
    otherUserToken = authService.generateToken(otherUser);
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await userRepository.delete(userId);
      await userRepository.delete(otherUserId);
    } catch (error) {
      // Ignore cleanup errors
    }
    await databaseService.disconnect();
  });

  beforeEach(async () => {
    // Clean up projects before each test
    const projects = await projectRepository.findByUser({ userId, page: 1, limit: 100 });
    for (const project of projects.projects) {
      await projectRepository.delete(project.id);
    }
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project'
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Test Project',
        description: 'A test project',
        userId
      });
      expect(response.body.message).toBe('Project created successfully');
      
      projectId = response.body.data.id;
    });

    it('should create a project without description', async () => {
      const projectData = {
        name: 'Test Project No Desc'
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Test Project No Desc',
        description: null,
        userId
      });
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Project name is required');
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' })
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await projectRepository.create({
        userId,
        name: 'Project 1',
        description: 'First project'
      });
      await projectRepository.create({
        userId,
        name: 'Project 2',
        description: 'Second project'
      });
      await projectRepository.create({
        userId,
        name: 'Search Test',
        description: 'Searchable project'
      });
    });

    it('should list user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/projects?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2
      });
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/projects?search=Search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Search Test');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await projectRepository.create({
        userId,
        name: 'Test Project',
        description: 'Test description'
      });
      projectId = project.id;

      // Add some files
      await projectFileRepository.create({
        projectId,
        filename: 'index.html',
        content: '<html></html>',
        type: 'HTML'
      });
    });

    it('should get project with files by default', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: projectId,
        name: 'Test Project',
        description: 'Test description'
      });
      expect(response.body.data.files).toHaveLength(1);
      expect(response.body.data.files[0].filename).toBe('index.html');
    });

    it('should get project without files when requested', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}?includeFiles=false`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: projectId,
        name: 'Test Project'
      });
      expect(response.body.data.files).toBeUndefined();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for project owned by another user', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await projectRepository.create({
        userId,
        name: 'Original Name',
        description: 'Original description'
      });
      projectId = project.id;
    });

    it('should update project name and description', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data).toMatchObject(updateData);
      expect(response.body.message).toBe('Project updated successfully');
    });

    it('should update only name', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name Only' })
        .expect(200);

      expect(response.body.data.name).toBe('New Name Only');
      expect(response.body.data.description).toBe('Original description');
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for no update fields', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('At least one field must be provided');
    });

    it('should return 403 for project owned by another user', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await projectRepository.create({
        userId,
        name: 'Project to Delete',
        description: 'Will be deleted'
      });
      projectId = project.id;
    });

    it('should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(projectId);
      expect(response.body.message).toBe('Project deleted successfully');

      // Verify project is deleted
      const project = await projectRepository.findById(projectId);
      expect(project).toBeNull();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for project owned by another user', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
  describe('Project File Management', () => {
    beforeEach(async () => {
      const project = await projectRepository.create({
        userId,
        name: 'File Test Project',
        description: 'For testing file operations'
      });
      projectId = project.id;
    });

    describe('GET /api/projects/:projectId/files', () => {
      beforeEach(async () => {
        await projectFileRepository.create({
          projectId,
          filename: 'index.html',
          content: '<html></html>',
          type: 'HTML'
        });
        await projectFileRepository.create({
          projectId,
          filename: 'style.css',
          content: 'body { margin: 0; }',
          type: 'CSS'
        });
      });

      it('should get all project files', async () => {
        const response = await request(app)
          .get(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].filename).toBe('index.html');
        expect(response.body.data[1].filename).toBe('style.css');
      });

      it('should return 403 for project owned by another user', async () => {
        const response = await request(app)
          .get(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${otherUserToken}`)
          .expect(403);

        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('GET /api/projects/:projectId/files/:filename', () => {
      beforeEach(async () => {
        await projectFileRepository.create({
          projectId,
          filename: 'test.js',
          content: 'console.log("test");',
          type: 'JS'
        });
      });

      it('should get specific file', async () => {
        const response = await request(app)
          .get(`/api/projects/${projectId}/files/test.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toMatchObject({
          filename: 'test.js',
          content: 'console.log("test");',
          type: 'JS',
          projectId
        });
      });

      it('should return 404 for non-existent file', async () => {
        const response = await request(app)
          .get(`/api/projects/${projectId}/files/nonexistent.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('POST /api/projects/:projectId/files', () => {
      it('should create new file', async () => {
        const fileData = {
          filename: 'new-file.html',
          content: '<h1>Hello World</h1>',
          type: 'HTML'
        };

        const response = await request(app)
          .post(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(fileData)
          .expect(201);

        expect(response.body.data).toMatchObject({
          ...fileData,
          projectId
        });
        expect(response.body.message).toBe('File created successfully');
      });

      it('should return 400 for missing filename', async () => {
        const response = await request(app)
          .post(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: '<h1>Test</h1>',
            type: 'HTML'
          })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_INPUT');
        expect(response.body.error.message).toContain('Filename is required');
      });

      it('should return 400 for invalid type', async () => {
        const response = await request(app)
          .post(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            filename: 'test.txt',
            content: 'test content',
            type: 'INVALID_TYPE'
          })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_INPUT');
        expect(response.body.error.message).toContain('Type is required and must be one of');
      });

      it('should return 400 for duplicate filename', async () => {
        // Create first file
        await projectFileRepository.create({
          projectId,
          filename: 'duplicate.html',
          content: '<html></html>',
          type: 'HTML'
        });

        // Try to create duplicate
        const response = await request(app)
          .post(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            filename: 'duplicate.html',
            content: '<html>new</html>',
            type: 'HTML'
          })
          .expect(400);

        expect(response.body.error.code).toBe('DUPLICATE');
      });
    });

    describe('PUT /api/projects/:projectId/files/:filename', () => {
      beforeEach(async () => {
        await projectFileRepository.create({
          projectId,
          filename: 'update-test.js',
          content: 'console.log("original");',
          type: 'JS'
        });
      });

      it('should update file content', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files/update-test.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: 'console.log("updated");'
          })
          .expect(200);

        expect(response.body.data.content).toBe('console.log("updated");');
        expect(response.body.message).toBe('File updated successfully');
      });

      it('should update file type', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files/update-test.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'JSON'
          })
          .expect(200);

        expect(response.body.data.type).toBe('JSON');
      });

      it('should return 400 for no update fields', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files/update-test.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_INPUT');
        expect(response.body.error.message).toContain('At least one field');
      });

      it('should return 404 for non-existent file', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files/nonexistent.js`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: 'new content'
          })
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('PUT /api/projects/:projectId/files (bulk update)', () => {
      it('should create or update multiple files', async () => {
        const filesData = {
          files: [
            {
              filename: 'index.html',
              content: '<html><body>Hello</body></html>',
              type: 'HTML'
            },
            {
              filename: 'style.css',
              content: 'body { color: red; }',
              type: 'CSS'
            },
            {
              filename: 'script.js',
              content: 'console.log("hello");',
              type: 'JS'
            }
          ]
        };

        const response = await request(app)
          .put(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(filesData)
          .expect(200);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.message).toBe('Files updated successfully');

        // Verify files were created
        const files = await projectFileRepository.findByProject(projectId);
        expect(files).toHaveLength(3);
      });

      it('should update existing files', async () => {
        // Create initial file
        await projectFileRepository.create({
          projectId,
          filename: 'existing.html',
          content: '<html>original</html>',
          type: 'HTML'
        });

        const filesData = {
          files: [
            {
              filename: 'existing.html',
              content: '<html>updated</html>',
              type: 'HTML'
            }
          ]
        };

        const response = await request(app)
          .put(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(filesData)
          .expect(200);

        expect(response.body.data[0].content).toBe('<html>updated</html>');
      });

      it('should return 400 for empty files array', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ files: [] })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_INPUT');
        expect(response.body.error.message).toContain('Files array is required');
      });

      it('should return 400 for invalid file data', async () => {
        const response = await request(app)
          .put(`/api/projects/${projectId}/files`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            files: [
              {
                filename: '',
                content: 'test',
                type: 'HTML'
              }
            ]
          })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_INPUT');
        expect(response.body.error.message).toContain('valid filename');
      });
    });

    describe('DELETE /api/projects/:projectId/files/:filename', () => {
      beforeEach(async () => {
        await projectFileRepository.create({
          projectId,
          filename: 'delete-test.html',
          content: '<html>to be deleted</html>',
          type: 'HTML'
        });
      });

      it('should delete file', async () => {
        const response = await request(app)
          .delete(`/api/projects/${projectId}/files/delete-test.html`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.filename).toBe('delete-test.html');
        expect(response.body.message).toBe('File deleted successfully');

        // Verify file is deleted
        const file = await projectFileRepository.findByProjectAndFilename(
          projectId,
          'delete-test.html'
        );
        expect(file).toBeNull();
      });

      it('should return 404 for non-existent file', async () => {
        const response = await request(app)
          .delete(`/api/projects/${projectId}/files/nonexistent.html`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });

  describe('POST /api/projects/:id/export', () => {
    beforeEach(async () => {
      const project = await projectRepository.create({
        userId,
        name: 'Export Test Project',
        description: 'Project for export testing'
      });
      projectId = project.id;

      // Add some files
      await projectFileRepository.create({
        projectId,
        filename: 'index.html',
        content: '<html><body><h1>Hello World</h1></body></html>',
        type: 'HTML'
      });
      await projectFileRepository.create({
        projectId,
        filename: 'style.css',
        content: 'body { font-family: Arial; }',
        type: 'CSS'
      });
      await projectFileRepository.create({
        projectId,
        filename: 'script.js',
        content: 'console.log("Hello from JS");',
        type: 'JS'
      });
    });

    it('should export project as ZIP', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .buffer(true)
        .parse((res, callback) => {
          let data = Buffer.alloc(0);
          res.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
          });
          res.on('end', () => {
            callback(null, data);
          });
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename=".*\.zip"/);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 400 for project with no files', async () => {
      // Create project without files
      const emptyProject = await projectRepository.create({
        userId,
        name: 'Empty Project',
        description: 'No files'
      });

      const response = await request(app)
        .post(`/api/projects/${emptyProject.id}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('NO_FILES');
      expect(response.body.error.message).toContain('no files to export');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/non-existent-id/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for project owned by another user', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});