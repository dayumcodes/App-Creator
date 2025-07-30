import request from 'supertest';
import app from '../../index';
import { ProjectRepository } from '../../repositories/ProjectRepository';
import { UserRepository } from '../../repositories/UserRepository';
import jwt from 'jsonwebtoken';

// Mock the repositories
jest.mock('../../repositories/ProjectRepository');
jest.mock('../../repositories/UserRepository');

const mockProjectRepository = {
  findById: jest.fn(),
  findWithFiles: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByUserId: jest.fn(),
};

const mockUserRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByEmail: jest.fn(),
};

// Mock the repository instances
(ProjectRepository as jest.MockedClass<typeof ProjectRepository>).mockImplementation(() => mockProjectRepository as any);
(UserRepository as jest.MockedClass<typeof UserRepository>).mockImplementation(() => mockUserRepository as any);

describe('Preview Routes', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterAll(() => {
    // Clean up the interval to prevent Jest from hanging
    const { clearCleanupInterval } = require('../../routes/preview');
    clearCleanupInterval();
  });

  const mockProject = {
    id: 'project-1',
    userId: 'user-1',
    name: 'Test Project',
    description: 'Test Description',
    files: [
      {
        id: 'file-1',
        projectId: 'project-1',
        filename: 'index.html',
        content: '<html><body><h1>Hello World</h1></body></html>',
        type: 'HTML' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-2',
        projectId: 'project-1',
        filename: 'style.css',
        content: 'body { color: red; }',
        type: 'CSS' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-3',
        projectId: 'project-1',
        filename: 'script.js',
        content: 'console.log("Hello from JS");',
        type: 'JS' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let authToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate auth token
    authToken = jwt.sign(
      { id: mockUser.id, email: mockUser.email },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup default mocks
    mockUserRepository.findById.mockResolvedValue(mockUser);
    mockProjectRepository.findWithFiles.mockResolvedValue(mockProject);
  });

  describe('POST /api/preview/generate-share-url', () => {
    it('should generate a shareable URL for a valid project', async () => {
      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' })
        .expect(200);

      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.shareUrl).toMatch(/\/api\/preview\/share\/[a-f0-9]{32}$/);
      
      // Verify expiration is approximately 24 hours from now
      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0);
    });

    it('should return 400 when project ID is missing', async () => {
      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_PROJECT_ID');
    });

    it('should return 404 when project does not exist', async () => {
      mockProjectRepository.findWithFiles.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'nonexistent-project' })
        .expect(404);

      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should return 403 when user does not own the project', async () => {
      const otherUserProject = { ...mockProject, userId: 'other-user' };
      mockProjectRepository.findWithFiles.mockResolvedValue(otherUserProject);

      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' })
        .expect(403);

      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app)
        .post('/api/preview/generate-share-url')
        .send({ projectId: 'project-1' })
        .expect(401);
    });

    it('should generate preview for project without HTML file', async () => {
      const projectWithoutHtml = {
        ...mockProject,
        files: [
          {
            id: 'file-2',
            projectId: 'project-1',
            filename: 'style.css',
            content: 'body { color: red; }',
            type: 'CSS' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      mockProjectRepository.findWithFiles.mockResolvedValue(projectWithoutHtml);

      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' })
        .expect(200);

      expect(response.body).toHaveProperty('shareUrl');
    });
  });

  describe('GET /api/preview/share/:previewId', () => {
    let previewId: string;

    beforeEach(async () => {
      // Generate a preview first
      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' });
      
      const shareUrl = response.body.shareUrl;
      previewId = shareUrl.split('/').pop();
    });

    it('should serve the preview content', async () => {
      const response = await request(app)
        .get(`/api/preview/share/${previewId}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('<html>');
      expect(response.text).toContain('Hello World');
      expect(response.text).toContain('body { color: red; }');
      expect(response.text).toContain('console.log("Hello from JS");');
    });

    it('should return 404 for non-existent preview ID', async () => {
      const response = await request(app)
        .get('/api/preview/share/nonexistent-id')
        .expect(404);

      expect(response.text).toContain('Preview Not Found');
    });

    it('should set appropriate security headers', async () => {
      const response = await request(app)
        .get(`/api/preview/share/${previewId}`)
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['content-security-policy']).toContain('default-src');
    });
  });

  describe('GET /api/preview/info/:previewId', () => {
    let previewId: string;

    beforeEach(async () => {
      // Generate a preview first
      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' });
      
      const shareUrl = response.body.shareUrl;
      previewId = shareUrl.split('/').pop();
    });

    it('should return preview info for the owner', async () => {
      const response = await request(app)
        .get(`/api/preview/info/${previewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('previewId', previewId);
      expect(response.body).toHaveProperty('projectId', 'project-1');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('isExpired', false);
    });

    it('should return 404 for non-existent preview ID', async () => {
      const response = await request(app)
        .get('/api/preview/info/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('PREVIEW_NOT_FOUND');
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app)
        .get(`/api/preview/info/${previewId}`)
        .expect(401);
    });
  });

  describe('Preview expiration', () => {
    it('should return 410 for expired preview', async () => {
      // Generate a preview first
      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' });
      
      const shareUrl = response.body.shareUrl;
      const previewId = shareUrl.split('/').pop();

      // Manually expire the preview by manipulating the storage
      const { previewStorage } = require('../../routes/preview');
      if (previewStorage && previewStorage.has(previewId)) {
        const preview = previewStorage.get(previewId);
        preview.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
        previewStorage.set(previewId, preview);
      }

      const expiredResponse = await request(app)
        .get(`/api/preview/share/${previewId}`)
        .expect(410);

      expect(expiredResponse.text).toContain('Preview Expired');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockProjectRepository.findWithFiles.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/preview/generate-share-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'project-1' })
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});