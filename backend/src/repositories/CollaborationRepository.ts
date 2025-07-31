import { PrismaClient, ProjectRole, CollaborationEventType } from '../generated/prisma';

export class CollaborationRepository {
  constructor(private prisma: PrismaClient) {}

  // Project Collaborators
  async addCollaborator(projectId: string, userId: string, role: ProjectRole, invitedBy: string) {
    return this.prisma.projectCollaborator.create({
      data: {
        projectId,
        userId,
        role,
        invitedBy,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async getProjectCollaborators(projectId: string) {
    return this.prisma.projectCollaborator.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async updateCollaboratorRole(projectId: string, userId: string, role: ProjectRole) {
    return this.prisma.projectCollaborator.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: { role },
    });
  }

  async removeCollaborator(projectId: string, userId: string) {
    return this.prisma.projectCollaborator.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  async acceptInvitation(projectId: string, userId: string) {
    return this.prisma.projectCollaborator.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: {
        acceptedAt: new Date(),
        isActive: true,
      },
    });
  }

  async getUserCollaborations(userId: string) {
    return this.prisma.projectCollaborator.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });
  }

  // Collaboration Sessions
  async createSession(projectId: string, userId: string, socketId: string) {
    return this.prisma.collaborationSession.create({
      data: {
        projectId,
        userId,
        socketId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async getActiveSessions(projectId: string) {
    return this.prisma.collaborationSession.findMany({
      where: {
        projectId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async updateSessionCursor(sessionId: string, cursor: any, activeFile?: string) {
    return this.prisma.collaborationSession.update({
      where: { id: sessionId },
      data: {
        cursor,
        activeFile,
        lastSeen: new Date(),
      },
    });
  }

  async endSession(socketId: string) {
    return this.prisma.collaborationSession.updateMany({
      where: { socketId },
      data: { isActive: false },
    });
  }

  async getSessionBySocketId(socketId: string) {
    return this.prisma.collaborationSession.findUnique({
      where: { socketId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // Collaboration Events
  async createEvent(
    projectId: string,
    userId: string,
    sessionId: string,
    eventType: CollaborationEventType,
    data: any
  ) {
    return this.prisma.collaborationEvent.create({
      data: {
        projectId,
        userId,
        sessionId,
        eventType,
        data,
      },
    });
  }

  async getRecentEvents(projectId: string, limit = 100) {
    return this.prisma.collaborationEvent.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  // Chat Messages
  async createChatMessage(projectId: string, userId: string, message: string) {
    return this.prisma.projectChatMessage.create({
      data: {
        projectId,
        userId,
        message,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async getChatMessages(projectId: string, limit = 50, offset = 0) {
    return this.prisma.projectChatMessage.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async updateChatMessage(messageId: string, message: string) {
    return this.prisma.projectChatMessage.update({
      where: { id: messageId },
      data: {
        message,
        isEdited: true,
        editedAt: new Date(),
      },
    });
  }

  async deleteChatMessage(messageId: string) {
    return this.prisma.projectChatMessage.delete({
      where: { id: messageId },
    });
  }

  // Permission checks
  async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId }, // Owner
          {
            collaborators: {
              some: {
                userId,
                isActive: true,
              },
            },
          }, // Collaborator
        ],
      },
    });

    return !!project;
  }

  async getUserProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    // Check if user is owner
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (project) {
      return ProjectRole.OWNER;
    }

    // Check if user is collaborator
    const collaborator = await this.prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return collaborator?.role || null;
  }
}