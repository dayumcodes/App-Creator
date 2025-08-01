import { SocketService } from '../../services/SocketService';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

// Mock socket.io
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    use: jest.fn(),
    sockets: {
      emit: jest.fn(),
    },
  })),
}));

describe('SocketService', () => {
  let socketService: SocketService;
  let mockHttpServer: HttpServer;
  let mockIo: any;

  beforeEach(() => {
    mockHttpServer = {} as HttpServer;
    mockIo = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      use: jest.fn(),
      sockets: {
        emit: jest.fn(),
      },
    };
    (SocketIOServer as jest.Mock).mockImplementation(() => mockIo);
    socketService = new SocketService(mockHttpServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize socket server with CORS configuration', () => {
      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: expect.any(String),
          methods: ['GET', 'POST'],
        },
      });
    });

    it('should set up connection event handler', () => {
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    let mockSocket: any;

    beforeEach(() => {
      mockSocket = {
        id: 'socket-123',
        on: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        disconnect: jest.fn(),
        handshake: {
          auth: {
            userId: 'user-123',
          },
        },
      };
    });

    it('should handle new socket connection', () => {
      const connectionHandler = mockIo.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('join-project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave-project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('code-change', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('cursor-position', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('joinProject', () => {
    it('should add user to project room', async () => {
      const userId = 'user-123';
      const projectId = 'project-123';

      await socketService.joinProject(userId, projectId);

      // Verify internal state management
      expect(socketService.getUserProjects(userId)).toContain(projectId);
    });
  });

  describe('leaveProject', () => {
    it('should remove user from project room', async () => {
      const userId = 'user-123';
      const projectId = 'project-123';

      // First join the project
      await socketService.joinProject(userId, projectId);
      expect(socketService.getUserProjects(userId)).toContain(projectId);

      // Then leave the project
      await socketService.leaveProject(userId, projectId);
      expect(socketService.getUserProjects(userId)).not.toContain(projectId);
    });
  });

  describe('broadcastCodeChange', () => {
    it('should broadcast code changes to project room', () => {
      const projectId = 'project-123';
      const change = {
        fileId: 'file-123',
        content: 'console.log("updated");',
        userId: 'user-123',
        timestamp: new Date(),
      };

      socketService.broadcastCodeChange(projectId, change);

      expect(mockIo.to).toHaveBeenCalledWith(`project:${projectId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('code-change', change);
    });
  });

  describe('broadcastCursorPosition', () => {
    it('should broadcast cursor position to project room', () => {
      const projectId = 'project-123';
      const cursorData = {
        userId: 'user-123',
        fileId: 'file-123',
        line: 10,
        column: 5,
        selection: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } },
      };

      socketService.broadcastCursorPosition(projectId, cursorData);

      expect(mockIo.to).toHaveBeenCalledWith(`project:${projectId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('cursor-position', cursorData);
    });
  });

  describe('broadcastUserJoined', () => {
    it('should broadcast user joined event to project room', () => {
      const projectId = 'project-123';
      const userData = {
        userId: 'user-123',
        username: 'testuser',
        avatar: 'https://example.com/avatar.jpg',
      };

      socketService.broadcastUserJoined(projectId, userData);

      expect(mockIo.to).toHaveBeenCalledWith(`project:${projectId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('user-joined', userData);
    });
  });

  describe('broadcastUserLeft', () => {
    it('should broadcast user left event to project room', () => {
      const projectId = 'project-123';
      const userId = 'user-123';

      socketService.broadcastUserLeft(projectId, userId);

      expect(mockIo.to).toHaveBeenCalledWith(`project:${projectId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('user-left', { userId });
    });
  });

  describe('getProjectUsers', () => {
    it('should return list of users in project', () => {
      const projectId = 'project-123';
      
      // Mock some users in the project
      socketService.joinProject('user-1', projectId);
      socketService.joinProject('user-2', projectId);

      const users = socketService.getProjectUsers(projectId);

      expect(users).toContain('user-1');
      expect(users).toContain('user-2');
    });
  });

  describe('getUserProjects', () => {
    it('should return list of projects for user', () => {
      const userId = 'user-123';
      
      // Mock user joining multiple projects
      socketService.joinProject(userId, 'project-1');
      socketService.joinProject(userId, 'project-2');

      const projects = socketService.getUserProjects(userId);

      expect(projects).toContain('project-1');
      expect(projects).toContain('project-2');
    });
  });

  describe('disconnect', () => {
    it('should clean up user data on disconnect', () => {
      const userId = 'user-123';
      const projectId = 'project-123';

      // Setup user in project
      socketService.joinProject(userId, projectId);
      expect(socketService.getUserProjects(userId)).toContain(projectId);

      // Simulate disconnect
      socketService.disconnect(userId);

      // Verify cleanup
      expect(socketService.getUserProjects(userId)).toHaveLength(0);
    });
  });
});