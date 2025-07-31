import { io, Socket } from 'socket.io-client';

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

export interface TextChange {
  filename: string;
  operations: Array<{
    type: 'insert' | 'delete' | 'retain';
    length?: number;
    text?: string;
  }>;
  version: number;
}

export interface CollaborationEvents {
  'project-joined': (data: {
    sessionId: string;
    activeSessions: Array<{
      sessionId: string;
      user: { id: string; username: string };
      cursor?: any;
      activeFile?: string;
      lastSeen: string;
    }>;
  }) => void;
  
  'user-joined': (data: {
    user: { id: string; username: string };
    sessionId: string;
  }) => void;
  
  'user-left': (data: {
    sessionId: string;
    userId: string;
  }) => void;
  
  'cursor-update': (data: {
    sessionId: string;
    userId: string;
    username: string;
    cursor: CursorPosition;
  }) => void;
  
  'text-change-applied': (data: {
    sessionId: string;
    userId: string;
    username: string;
    change: TextChange;
  }) => void;
  
  'file-changed': (data: {
    sessionId: string;
    userId: string;
    username: string;
    filename: string;
    content: string;
    changeType: 'create' | 'update' | 'delete';
    timestamp: string;
  }) => void;
  
  'chat-message-received': (data: {
    id: string;
    message: string;
    timestamp: string;
    user: { id: string; username: string };
    isEdited: boolean;
  }) => void;
  
  'presence-updated': (data: {
    sessionId: string;
    userId: string;
    username: string;
    status: 'active' | 'idle' | 'away';
    timestamp: string;
  }) => void;
  
  'user-disconnected': (data: {
    sessionId: string;
    userId: string;
    username: string;
  }) => void;
  
  'collaborator-invited': (data: {
    collaborator: {
      id: string;
      user: { id: string; username: string; email: string };
      role: string;
      invitedAt: string;
    };
  }) => void;
  
  'error': (data: { message: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;
  private eventListeners: Map<keyof CollaborationEvents, Function[]> = new Map();

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('Connected to collaboration server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from collaboration server:', reason);
      });

      // Set up event forwarding
      this.setupEventForwarding();
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentProjectId = null;
      this.eventListeners.clear();
    }
  }

  private setupEventForwarding(): void {
    if (!this.socket) return;

    const events: (keyof CollaborationEvents)[] = [
      'project-joined',
      'user-joined',
      'user-left',
      'cursor-update',
      'text-change-applied',
      'file-changed',
      'chat-message-received',
      'presence-updated',
      'user-disconnected',
      'collaborator-invited',
      'error',
    ];

    events.forEach(event => {
      this.socket!.on(event, (data: any) => {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => listener(data));
      });
    });
  }

  // Event listener management
  on<K extends keyof CollaborationEvents>(
    event: K,
    listener: CollaborationEvents[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off<K extends keyof CollaborationEvents>(
    event: K,
    listener: CollaborationEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Project collaboration
  joinProject(projectId: string): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    if (this.currentProjectId && this.currentProjectId !== projectId) {
      this.leaveProject(this.currentProjectId);
    }

    this.currentProjectId = projectId;
    this.socket.emit('join-project', { projectId });
  }

  leaveProject(projectId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('leave-project', { projectId });
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
    }
  }

  // Cursor tracking
  updateCursor(cursor: CursorPosition): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('cursor-move', {
      projectId: this.currentProjectId,
      cursor,
    });
  }

  // Text editing
  sendTextChange(change: TextChange): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('text-change', {
      projectId: this.currentProjectId,
      change,
    });
  }

  // File operations
  sendFileChange(
    filename: string,
    content: string,
    changeType: 'create' | 'update' | 'delete'
  ): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('file-change', {
      projectId: this.currentProjectId,
      filename,
      content,
      changeType,
    });
  }

  // Chat
  sendChatMessage(message: string): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('chat-message', {
      projectId: this.currentProjectId,
      message,
    });
  }

  // Collaboration management
  inviteCollaborator(userEmail: string, role: 'EDITOR' | 'VIEWER'): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('invite-collaborator', {
      projectId: this.currentProjectId,
      userEmail,
      role,
    });
  }

  // Presence
  updatePresence(status: 'active' | 'idle' | 'away'): void {
    if (!this.socket?.connected || !this.currentProjectId) return;

    this.socket.emit('presence-update', {
      projectId: this.currentProjectId,
      status,
    });
  }

  // Getters
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get currentProject(): string | null {
    return this.currentProjectId;
  }
}

export const socketService = new SocketService();