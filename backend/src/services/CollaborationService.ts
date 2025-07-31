import { CollaborationRepository } from '../repositories/CollaborationRepository';
import { ProjectRole, CollaborationEventType } from '../generated/prisma';

export interface CollaborationOperation {
  type: 'insert' | 'delete' | 'retain';
  length?: number;
  text?: string;
}

export interface TextChange {
  filename: string;
  operations: CollaborationOperation[];
  version: number;
}

export interface CursorPosition {
  filename: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export class CollaborationService {
  constructor(private collaborationRepo: CollaborationRepository) {}

  // Project Collaboration Management
  async inviteCollaborator(
    projectId: string,
    userEmail: string,
    role: ProjectRole,
    invitedBy: string
  ) {
    // In a real implementation, you'd look up the user by email
    // For now, we'll assume the userEmail is actually a userId
    const userId = userEmail;
    
    return this.collaborationRepo.addCollaborator(projectId, userId, role, invitedBy);
  }

  async acceptInvitation(projectId: string, userId: string) {
    return this.collaborationRepo.acceptInvitation(projectId, userId);
  }

  async removeCollaborator(projectId: string, userId: string) {
    return this.collaborationRepo.removeCollaborator(projectId, userId);
  }

  async updateCollaboratorRole(projectId: string, userId: string, role: ProjectRole) {
    return this.collaborationRepo.updateCollaboratorRole(projectId, userId, role);
  }

  async getProjectCollaborators(projectId: string) {
    return this.collaborationRepo.getProjectCollaborators(projectId);
  }

  // Session Management
  async createSession(projectId: string, userId: string, socketId: string) {
    const session = await this.collaborationRepo.createSession(projectId, userId, socketId);
    
    // Log join event
    await this.collaborationRepo.createEvent(
      projectId,
      userId,
      session.id,
      CollaborationEventType.USER_JOIN,
      { timestamp: new Date() }
    );

    return session;
  }

  async endSession(socketId: string) {
    const session = await this.collaborationRepo.getSessionBySocketId(socketId);
    if (session) {
      // Log leave event
      await this.collaborationRepo.createEvent(
        session.projectId,
        session.userId,
        session.id,
        CollaborationEventType.USER_LEAVE,
        { timestamp: new Date() }
      );
    }

    return this.collaborationRepo.endSession(socketId);
  }

  async getActiveSessions(projectId: string) {
    return this.collaborationRepo.getActiveSessions(projectId);
  }

  async updateCursor(sessionId: string, cursor: CursorPosition) {
    const session = await this.collaborationRepo.updateSessionCursor(
      sessionId,
      cursor,
      cursor.filename
    );

    if (session) {
      // Log cursor move event
      await this.collaborationRepo.createEvent(
        session.projectId,
        session.userId,
        sessionId,
        CollaborationEventType.CURSOR_MOVE,
        cursor
      );
    }

    return session;
  }

  // Operational Transformation for collaborative editing
  async applyTextChange(
    sessionId: string,
    change: TextChange
  ): Promise<TextChange> {
    const session = await this.collaborationRepo.getSessionBySocketId(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // In a real implementation, you would:
    // 1. Get the current document state
    // 2. Apply operational transformation to resolve conflicts
    // 3. Update the document
    // 4. Broadcast the transformed change to other clients

    // For now, we'll just log the change and return it
    await this.collaborationRepo.createEvent(
      session.projectId,
      session.userId,
      session.id,
      CollaborationEventType.TEXT_CHANGE,
      change
    );

    return change;
  }

  // Simple operational transformation implementation
  private transformOperation(
    op1: CollaborationOperation,
    op2: CollaborationOperation,
    priority: 'left' | 'right'
  ): [CollaborationOperation, CollaborationOperation] {
    // This is a simplified OT implementation
    // In production, you'd use a library like ShareJS or Yjs
    
    if (op1.type === 'retain' && op2.type === 'retain') {
      const minLength = Math.min(op1.length || 0, op2.length || 0);
      return [
        { type: 'retain', length: minLength },
        { type: 'retain', length: minLength }
      ];
    }

    if (op1.type === 'insert' && op2.type === 'insert') {
      if (priority === 'left') {
        return [op1, { ...op2, length: (op2.length || 0) + (op1.text?.length || 0) }];
      } else {
        return [{ ...op1, length: (op1.length || 0) + (op2.text?.length || 0) }, op2];
      }
    }

    // More transformation rules would be implemented here
    return [op1, op2];
  }

  // Chat functionality
  async sendChatMessage(projectId: string, userId: string, message: string) {
    const chatMessage = await this.collaborationRepo.createChatMessage(
      projectId,
      userId,
      message
    );

    // Log chat event
    await this.collaborationRepo.createEvent(
      projectId,
      userId,
      '', // No specific session for chat
      CollaborationEventType.CHAT_MESSAGE,
      { messageId: chatMessage.id, message }
    );

    return chatMessage;
  }

  async getChatMessages(projectId: string, limit = 50, offset = 0) {
    return this.collaborationRepo.getChatMessages(projectId, limit, offset);
  }

  // Permission management
  async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    return this.collaborationRepo.hasProjectAccess(projectId, userId);
  }

  async getUserProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    return this.collaborationRepo.getUserProjectRole(projectId, userId);
  }

  async canEdit(projectId: string, userId: string): Promise<boolean> {
    const role = await this.getUserProjectRole(projectId, userId);
    return role === ProjectRole.OWNER || role === ProjectRole.EDITOR;
  }

  async canManageCollaborators(projectId: string, userId: string): Promise<boolean> {
    const role = await this.getUserProjectRole(projectId, userId);
    return role === ProjectRole.OWNER;
  }

  // Conflict resolution
  async resolveConflict(
    projectId: string,
    filename: string,
    conflictingChanges: TextChange[]
  ): Promise<TextChange> {
    // Simple conflict resolution: last writer wins
    // In production, you'd implement more sophisticated conflict resolution
    const latestChange = conflictingChanges.sort((a, b) => b.version - a.version)[0];
    
    await this.collaborationRepo.createEvent(
      projectId,
      '', // System event
      '',
      CollaborationEventType.FILE_CHANGE,
      {
        filename,
        conflictResolution: 'last-writer-wins',
        resolvedChange: latestChange
      }
    );

    return latestChange;
  }

  // Get collaboration history
  async getCollaborationHistory(projectId: string, limit = 100) {
    return this.collaborationRepo.getRecentEvents(projectId, limit);
  }
}