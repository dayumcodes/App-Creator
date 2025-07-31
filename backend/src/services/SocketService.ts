import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { CollaborationService, TextChange, CursorPosition } from './CollaborationService';
import { CollaborationRepository } from '../repositories/CollaborationRepository';
import { PrismaClient } from '../generated/prisma';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
  sessionId?: string;
}

export class SocketService {
  private io: SocketIOServer;
  private collaborationService: CollaborationService;

  constructor(server: HTTPServer, prisma: PrismaClient) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    const collaborationRepo = new CollaborationRepository(prisma);
    this.collaborationService = new CollaborationService(collaborationRepo);

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.username} connected with socket ${socket.id}`);

      // Join project room
      socket.on('join-project', async (data: { projectId: string }) => {
        try {
          const { projectId } = data;

          // Check if user has access to the project
          const hasAccess = await this.collaborationService.hasProjectAccess(
            projectId,
            socket.userId
          );

          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied to project' });
            return;
          }

          // Create collaboration session
          const session = await this.collaborationService.createSession(
            projectId,
            socket.userId,
            socket.id
          );

          socket.sessionId = session.id;
          socket.join(projectId);

          // Get active sessions and broadcast user joined
          const activeSessions = await this.collaborationService.getActiveSessions(projectId);
          
          socket.to(projectId).emit('user-joined', {
            user: session.user,
            sessionId: session.id,
          });

          socket.emit('project-joined', {
            sessionId: session.id,
            activeSessions: activeSessions.map(s => ({
              sessionId: s.id,
              user: s.user,
              cursor: s.cursor,
              activeFile: s.activeFile,
              lastSeen: s.lastSeen,
            })),
          });

        } catch (error) {
          console.error('Error joining project:', error);
          socket.emit('error', { message: 'Failed to join project' });
        }
      });

      // Leave project room
      socket.on('leave-project', async (data: { projectId: string }) => {
        try {
          const { projectId } = data;
          socket.leave(projectId);

          if (socket.sessionId) {
            await this.collaborationService.endSession(socket.id);
            
            socket.to(projectId).emit('user-left', {
              sessionId: socket.sessionId,
              userId: socket.userId,
            });
          }
        } catch (error) {
          console.error('Error leaving project:', error);
        }
      });

      // Handle cursor movement
      socket.on('cursor-move', async (data: { projectId: string; cursor: CursorPosition }) => {
        try {
          const { projectId, cursor } = data;

          if (!socket.sessionId) {
            socket.emit('error', { message: 'No active session' });
            return;
          }

          await this.collaborationService.updateCursor(socket.sessionId, cursor);

          // Broadcast cursor position to other users in the project
          socket.to(projectId).emit('cursor-update', {
            sessionId: socket.sessionId,
            userId: socket.userId,
            username: socket.username,
            cursor,
          });

        } catch (error) {
          console.error('Error updating cursor:', error);
          socket.emit('error', { message: 'Failed to update cursor' });
        }
      });

      // Handle text changes (collaborative editing)
      socket.on('text-change', async (data: { projectId: string; change: TextChange }) => {
        try {
          const { projectId, change } = data;

          // Check if user can edit
          const canEdit = await this.collaborationService.canEdit(projectId, socket.userId);
          if (!canEdit) {
            socket.emit('error', { message: 'No edit permission' });
            return;
          }

          // Apply operational transformation
          const transformedChange = await this.collaborationService.applyTextChange(
            socket.id,
            change
          );

          // Broadcast the change to other users in the project
          socket.to(projectId).emit('text-change-applied', {
            sessionId: socket.sessionId,
            userId: socket.userId,
            username: socket.username,
            change: transformedChange,
          });

        } catch (error) {
          console.error('Error applying text change:', error);
          socket.emit('error', { message: 'Failed to apply text change' });
        }
      });

      // Handle file changes
      socket.on('file-change', async (data: { 
        projectId: string; 
        filename: string; 
        content: string; 
        changeType: 'create' | 'update' | 'delete' 
      }) => {
        try {
          const { projectId, filename, content, changeType } = data;

          // Check if user can edit
          const canEdit = await this.collaborationService.canEdit(projectId, socket.userId);
          if (!canEdit) {
            socket.emit('error', { message: 'No edit permission' });
            return;
          }

          // Broadcast file change to other users
          socket.to(projectId).emit('file-changed', {
            sessionId: socket.sessionId,
            userId: socket.userId,
            username: socket.username,
            filename,
            content,
            changeType,
            timestamp: new Date(),
          });

        } catch (error) {
          console.error('Error handling file change:', error);
          socket.emit('error', { message: 'Failed to handle file change' });
        }
      });

      // Handle chat messages
      socket.on('chat-message', async (data: { projectId: string; message: string }) => {
        try {
          const { projectId, message } = data;

          const chatMessage = await this.collaborationService.sendChatMessage(
            projectId,
            socket.userId,
            message
          );

          // Broadcast chat message to all users in the project
          this.io.to(projectId).emit('chat-message-received', {
            id: chatMessage.id,
            message: chatMessage.message,
            timestamp: chatMessage.timestamp,
            user: chatMessage.user,
            isEdited: chatMessage.isEdited,
          });

        } catch (error) {
          console.error('Error sending chat message:', error);
          socket.emit('error', { message: 'Failed to send chat message' });
        }
      });

      // Handle collaboration invitations
      socket.on('invite-collaborator', async (data: {
        projectId: string;
        userEmail: string;
        role: 'EDITOR' | 'VIEWER';
      }) => {
        try {
          const { projectId, userEmail, role } = data;

          // Check if user can manage collaborators
          const canManage = await this.collaborationService.canManageCollaborators(
            projectId,
            socket.userId
          );

          if (!canManage) {
            socket.emit('error', { message: 'No permission to manage collaborators' });
            return;
          }

          const collaborator = await this.collaborationService.inviteCollaborator(
            projectId,
            userEmail,
            role as any,
            socket.userId
          );

          socket.emit('collaborator-invited', {
            collaborator: {
              id: collaborator.id,
              user: collaborator.user,
              role: collaborator.role,
              invitedAt: collaborator.invitedAt,
            },
          });

        } catch (error) {
          console.error('Error inviting collaborator:', error);
          socket.emit('error', { message: 'Failed to invite collaborator' });
        }
      });

      // Handle presence updates
      socket.on('presence-update', async (data: { 
        projectId: string; 
        status: 'active' | 'idle' | 'away' 
      }) => {
        try {
          const { projectId, status } = data;

          // Broadcast presence update to other users
          socket.to(projectId).emit('presence-updated', {
            sessionId: socket.sessionId,
            userId: socket.userId,
            username: socket.username,
            status,
            timestamp: new Date(),
          });

        } catch (error) {
          console.error('Error updating presence:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        console.log(`User ${socket.username} disconnected`);
        
        try {
          if (socket.sessionId) {
            await this.collaborationService.endSession(socket.id);
            
            // Notify all rooms that this user has disconnected
            socket.broadcast.emit('user-disconnected', {
              sessionId: socket.sessionId,
              userId: socket.userId,
              username: socket.username,
            });
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
  }

  // Method to send notifications to specific users
  public notifyUser(userId: string, event: string, data: any) {
    // Find all sockets for this user and emit the event
    const userSockets = Array.from(this.io.sockets.sockets.values())
      .filter((socket: any) => socket.userId === userId);
    
    userSockets.forEach(socket => {
      socket.emit(event, data);
    });
  }

  // Method to broadcast to a project room
  public broadcastToProject(projectId: string, event: string, data: any) {
    this.io.to(projectId).emit(event, data);
  }

  public getIO() {
    return this.io;
  }
}