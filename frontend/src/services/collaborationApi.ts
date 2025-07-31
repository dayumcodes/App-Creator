import { api } from './api';

export interface Collaborator {
  id: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  invitedAt: string;
  acceptedAt?: string;
  isActive: boolean;
}

export interface CollaborationSession {
  sessionId: string;
  user: {
    id: string;
    username: string;
  };
  cursor?: any;
  activeFile?: string;
  lastSeen: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  timestamp: string;
  user: {
    id: string;
    username: string;
  };
  isEdited: boolean;
  editedAt?: string;
}

export interface CollaborationEvent {
  id: string;
  eventType: 'USER_JOIN' | 'USER_LEAVE' | 'CURSOR_MOVE' | 'TEXT_CHANGE' | 'FILE_CHANGE' | 'CHAT_MESSAGE';
  data: any;
  timestamp: string;
  user: {
    id: string;
    username: string;
  };
}

export const collaborationApi = {
  // Collaborator management
  async getCollaborators(projectId: string): Promise<Collaborator[]> {
    const response = await api.get(`/collaboration/projects/${projectId}/collaborators`);
    return response.data.collaborators;
  },

  async inviteCollaborator(projectId: string, userEmail: string, role: 'EDITOR' | 'VIEWER'): Promise<Collaborator> {
    const response = await api.post(`/collaboration/projects/${projectId}/collaborators`, {
      userEmail,
      role,
    });
    return response.data.collaborator;
  },

  async updateCollaboratorRole(projectId: string, collaboratorId: string, role: 'EDITOR' | 'VIEWER'): Promise<Collaborator> {
    const response = await api.put(`/collaboration/projects/${projectId}/collaborators/${collaboratorId}`, {
      role,
    });
    return response.data.collaborator;
  },

  async removeCollaborator(projectId: string, collaboratorId: string): Promise<void> {
    await api.delete(`/collaboration/projects/${projectId}/collaborators/${collaboratorId}`);
  },

  async acceptInvitation(projectId: string): Promise<Collaborator> {
    const response = await api.post(`/collaboration/projects/${projectId}/collaborators/accept`);
    return response.data.collaborator;
  },

  // Session management
  async getActiveSessions(projectId: string): Promise<CollaborationSession[]> {
    const response = await api.get(`/collaboration/projects/${projectId}/sessions`);
    return response.data.sessions;
  },

  // Chat
  async getChatMessages(projectId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const response = await api.get(`/collaboration/projects/${projectId}/chat`, {
      params: { limit, offset },
    });
    return response.data.messages;
  },

  // History
  async getCollaborationHistory(projectId: string, limit = 100): Promise<CollaborationEvent[]> {
    const response = await api.get(`/collaboration/projects/${projectId}/history`, {
      params: { limit },
    });
    return response.data.history;
  },

  // User role
  async getUserRole(projectId: string): Promise<'OWNER' | 'EDITOR' | 'VIEWER'> {
    const response = await api.get(`/collaboration/projects/${projectId}/role`);
    return response.data.role;
  },

  // User collaborations
  async getUserCollaborations(): Promise<any[]> {
    const response = await api.get('/collaboration/collaborations');
    return response.data.collaborations;
  },
};