import request from 'supertest';
import express from 'express';
import collaborationRoutes from '../../routes/collaboration';
import { authenticateToken } from '../../middleware/auth';
import { ProjectRole } from '../../generated/prisma';

// Mock the middleware and services
jest.mock('../../middleware/auth');
jest.mock('../../services/CollaborationService');
jest.mock('../../repositories/CollaborationRepository');

const app = express();
app.use(express.json());
app.use('/collaboration', collaborationRoutes);

const mockAuthMiddleware = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

describe('Collaboration Routes', () => {
  beforeEach(() => {
    // Mock auth middleware to add user to request
    mockAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 'user-1', username: 'testuser' };
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /projects/:projectId/collaborators', () => {
    it('should get project collaborators successfully', async () => {
      const mockCollaborators = [
        {
          id: 'collab-1',
          user: { id: 'user-2', username: 'user2', email: 'user2@example.com' },
          role: ProjectRole.EDITOR,
          invitedAt: new Date().toISOString(),
          isActive: true,
        },
      ];

      // Mock the collaboration service methods
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.hasProjectAccess = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.getProjectCollaborators = jest.fn().mockResolvedValue(mockCollaborators);

      const response = await request(app)
        .get('/collaboration/projects/project-1/collaborators')
        .expect(200);

      expect(response.body).toEqual({ collaborators: mockCollaborators });
    });

    it('should return 403 if user has no access', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.hasProjectAccess = jest.fn().mockResolvedValue(false);

      await request(app)
        .get('/collaboration/projects/project-1/collaborators')
        .expect(403);
    });
  });

  describe('POST /projects/:projectId/collaborators', () => {
    it('should invite collaborator successfully', async () => {
      const mockCollaborator = {
        id: 'collab-1',
        user: { id: 'user-2', username: 'user2', email: 'user2@example.com' },
        role: ProjectRole.EDITOR,
        invitedAt: new Date().toISOString(),
      };

      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.canManageCollaborators = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.inviteCollaborator = jest.fn().mockResolvedValue(mockCollaborator);

      const response = await request(app)
        .post('/collaboration/projects/project-1/collaborators')
        .send({
          userEmail: 'user2@example.com',
          role: ProjectRole.EDITOR,
        })
        .expect(201);

      expect(response.body).toEqual({ collaborator: mockCollaborator });
    });

    it('should return 403 if user cannot manage collaborators', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.canManageCollaborators = jest.fn().mockResolvedValue(false);

      await request(app)
        .post('/collaboration/projects/project-1/collaborators')
        .send({
          userEmail: 'user2@example.com',
          role: ProjectRole.EDITOR,
        })
        .expect(403);
    });

    it('should return 400 for invalid role', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.canManageCollaborators = jest.fn().mockResolvedValue(true);

      await request(app)
        .post('/collaboration/projects/project-1/collaborators')
        .send({
          userEmail: 'user2@example.com',
          role: 'INVALID_ROLE',
        })
        .expect(400);
    });
  });

  describe('PUT /projects/:projectId/collaborators/:collaboratorId', () => {
    it('should update collaborator role successfully', async () => {
      const mockCollaborator = {
        id: 'collab-1',
        role: ProjectRole.VIEWER,
      };

      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.canManageCollaborators = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.updateCollaboratorRole = jest.fn().mockResolvedValue(mockCollaborator);

      const response = await request(app)
        .put('/collaboration/projects/project-1/collaborators/collab-1')
        .send({ role: ProjectRole.VIEWER })
        .expect(200);

      expect(response.body).toEqual({ collaborator: mockCollaborator });
    });
  });

  describe('DELETE /projects/:projectId/collaborators/:collaboratorId', () => {
    it('should remove collaborator successfully', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.canManageCollaborators = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.removeCollaborator = jest.fn().mockResolvedValue(undefined);

      await request(app)
        .delete('/collaboration/projects/project-1/collaborators/collab-1')
        .expect(204);
    });
  });

  describe('POST /projects/:projectId/collaborators/accept', () => {
    it('should accept invitation successfully', async () => {
      const mockCollaborator = {
        id: 'collab-1',
        isActive: true,
        acceptedAt: new Date().toISOString(),
      };

      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.acceptInvitation = jest.fn().mockResolvedValue(mockCollaborator);

      const response = await request(app)
        .post('/collaboration/projects/project-1/collaborators/accept')
        .expect(200);

      expect(response.body).toEqual({ collaborator: mockCollaborator });
    });
  });

  describe('GET /projects/:projectId/chat', () => {
    it('should get chat messages successfully', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          message: 'Hello team!',
          timestamp: new Date().toISOString(),
          user: { id: 'user-1', username: 'user1' },
        },
      ];

      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.hasProjectAccess = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.getChatMessages = jest.fn().mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/collaboration/projects/project-1/chat')
        .expect(200);

      expect(response.body).toEqual({ messages: mockMessages });
    });

    it('should handle pagination parameters', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.hasProjectAccess = jest.fn().mockResolvedValue(true);
      CollaborationService.prototype.getChatMessages = jest.fn().mockResolvedValue([]);

      await request(app)
        .get('/collaboration/projects/project-1/chat?limit=25&offset=10')
        .expect(200);

      expect(CollaborationService.prototype.getChatMessages).toHaveBeenCalledWith('project-1', 25, 10);
    });
  });

  describe('GET /projects/:projectId/role', () => {
    it('should get user role successfully', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.getUserProjectRole = jest.fn().mockResolvedValue(ProjectRole.OWNER);

      const response = await request(app)
        .get('/collaboration/projects/project-1/role')
        .expect(200);

      expect(response.body).toEqual({ role: ProjectRole.OWNER });
    });

    it('should return 403 if user has no role', async () => {
      const { CollaborationService } = require('../../services/CollaborationService');
      CollaborationService.prototype.getUserProjectRole = jest.fn().mockResolvedValue(null);

      await request(app)
        .get('/collaboration/projects/project-1/role')
        .expect(403);
    });
  });
});