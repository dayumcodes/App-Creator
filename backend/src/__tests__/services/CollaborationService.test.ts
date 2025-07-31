import { CollaborationService } from '../../services/CollaborationService';
import { CollaborationRepository } from '../../repositories/CollaborationRepository';
import { ProjectRole, CollaborationEventType } from '../../generated/prisma';

// Mock the repository
jest.mock('../../repositories/CollaborationRepository');

describe('CollaborationService', () => {
  let collaborationService: CollaborationService;
  let mockCollaborationRepo: jest.Mocked<CollaborationRepository>;

  beforeEach(() => {
    mockCollaborationRepo = new CollaborationRepository({} as any) as jest.Mocked<CollaborationRepository>;
    collaborationService = new CollaborationService(mockCollaborationRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inviteCollaborator', () => {
    it('should invite a collaborator successfully', async () => {
      const mockCollaborator = {
        id: 'collab-1',
        projectId: 'project-1',
        userId: 'user-2',
        role: ProjectRole.EDITOR,
        invitedBy: 'user-1',
        invitedAt: new Date(),
        acceptedAt: null,
        isActive: false,
        user: {
          id: 'user-2',
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      mockCollaborationRepo.addCollaborator.mockResolvedValue(mockCollaborator);

      const result = await collaborationService.inviteCollaborator(
        'project-1',
        'user-2',
        ProjectRole.EDITOR,
        'user-1'
      );

      expect(mockCollaborationRepo.addCollaborator).toHaveBeenCalledWith(
        'project-1',
        'user-2',
        ProjectRole.EDITOR,
        'user-1'
      );
      expect(result).toEqual(mockCollaborator);
    });
  });

  describe('createSession', () => {
    it('should create a collaboration session and log join event', async () => {
      const mockSession = {
        id: 'session-1',
        projectId: 'project-1',
        userId: 'user-1',
        socketId: 'socket-1',
        isActive: true,
        lastSeen: new Date(),
        cursor: null,
        activeFile: null,
        user: {
          id: 'user-1',
          username: 'testuser',
        },
      };

      mockCollaborationRepo.createSession.mockResolvedValue(mockSession);
      mockCollaborationRepo.createEvent.mockResolvedValue({} as any);

      const result = await collaborationService.createSession(
        'project-1',
        'user-1',
        'socket-1'
      );

      expect(mockCollaborationRepo.createSession).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        'socket-1'
      );
      expect(mockCollaborationRepo.createEvent).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        'session-1',
        CollaborationEventType.USER_JOIN,
        { timestamp: expect.any(Date) }
      );
      expect(result).toEqual(mockSession);
    });
  });

  describe('endSession', () => {
    it('should end session and log leave event', async () => {
      const mockSession = {
        id: 'session-1',
        projectId: 'project-1',
        userId: 'user-1',
        socketId: 'socket-1',
        isActive: true,
        cursor: null,
        lastSeen: new Date(),
        activeFile: null,
        user: { id: 'user-1', username: 'testuser' },
        project: { id: 'project-1', name: 'Test Project' },
      };

      mockCollaborationRepo.getSessionBySocketId.mockResolvedValue(mockSession);
      mockCollaborationRepo.createEvent.mockResolvedValue({} as any);
      mockCollaborationRepo.endSession.mockResolvedValue({} as any);

      await collaborationService.endSession('socket-1');

      expect(mockCollaborationRepo.getSessionBySocketId).toHaveBeenCalledWith('socket-1');
      expect(mockCollaborationRepo.createEvent).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        'session-1',
        CollaborationEventType.USER_LEAVE,
        { timestamp: expect.any(Date) }
      );
      expect(mockCollaborationRepo.endSession).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('sendChatMessage', () => {
    it('should send chat message and log event', async () => {
      const mockMessage = {
        id: 'msg-1',
        projectId: 'project-1',
        userId: 'user-1',
        message: 'Hello team!',
        timestamp: new Date(),
        isEdited: false,
        editedAt: null,
        user: {
          id: 'user-1',
          username: 'testuser',
        },
      };

      mockCollaborationRepo.createChatMessage.mockResolvedValue(mockMessage);
      mockCollaborationRepo.createEvent.mockResolvedValue({} as any);

      const result = await collaborationService.sendChatMessage(
        'project-1',
        'user-1',
        'Hello team!'
      );

      expect(mockCollaborationRepo.createChatMessage).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        'Hello team!'
      );
      expect(mockCollaborationRepo.createEvent).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        '',
        CollaborationEventType.CHAT_MESSAGE,
        { messageId: 'msg-1', message: 'Hello team!' }
      );
      expect(result).toEqual(mockMessage);
    });
  });

  describe('hasProjectAccess', () => {
    it('should return true if user has access', async () => {
      mockCollaborationRepo.hasProjectAccess.mockResolvedValue(true);

      const result = await collaborationService.hasProjectAccess('project-1', 'user-1');

      expect(mockCollaborationRepo.hasProjectAccess).toHaveBeenCalledWith('project-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false if user has no access', async () => {
      mockCollaborationRepo.hasProjectAccess.mockResolvedValue(false);

      const result = await collaborationService.hasProjectAccess('project-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('should return true for owner', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.OWNER);

      const result = await collaborationService.canEdit('project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true for editor', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.EDITOR);

      const result = await collaborationService.canEdit('project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for viewer', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.VIEWER);

      const result = await collaborationService.canEdit('project-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false for no role', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(null);

      const result = await collaborationService.canEdit('project-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('canManageCollaborators', () => {
    it('should return true for owner', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.OWNER);

      const result = await collaborationService.canManageCollaborators('project-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for editor', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.EDITOR);

      const result = await collaborationService.canManageCollaborators('project-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false for viewer', async () => {
      mockCollaborationRepo.getUserProjectRole.mockResolvedValue(ProjectRole.VIEWER);

      const result = await collaborationService.canManageCollaborators('project-1', 'user-1');

      expect(result).toBe(false);
    });
  });
});