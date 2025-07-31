import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { socketService, CursorPosition, TextChange } from '../services/socketService';
import { collaborationApi, Collaborator, ChatMessage, CollaborationSession } from '../services/collaborationApi';

export interface CollaboratorPresence {
  sessionId: string;
  userId: string;
  username: string;
  cursor?: CursorPosition;
  activeFile?: string;
  status: 'active' | 'idle' | 'away';
  lastSeen: string;
}

export interface UseCollaborationOptions {
  projectId: string;
  onTextChange?: (change: TextChange, userId: string, username: string) => void;
  onFileChange?: (filename: string, content: string, changeType: 'create' | 'update' | 'delete', userId: string, username: string) => void;
  onCursorUpdate?: (cursor: CursorPosition, userId: string, username: string) => void;
}

export const useCollaboration = ({ 
  projectId, 
  onTextChange, 
  onFileChange, 
  onCursorUpdate 
}: UseCollaborationOptions) => {
  const { token } = useSelector((state: RootState) => state.auth);
  
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeSessions, setActiveSessions] = useState<CollaborationSession[]>([]);
  const [collaboratorPresence, setCollaboratorPresence] = useState<Map<string, CollaboratorPresence>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userRole, setUserRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize collaboration
  useEffect(() => {
    if (!token || !projectId) return;

    const initializeCollaboration = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Connect to WebSocket
        await socketService.connect(token);
        setIsConnected(true);

        // Load initial data
        const [collaboratorsData, userRoleData, chatData] = await Promise.all([
          collaborationApi.getCollaborators(projectId),
          collaborationApi.getUserRole(projectId),
          collaborationApi.getChatMessages(projectId, 50, 0),
        ]);

        setCollaborators(collaboratorsData);
        setUserRole(userRoleData);
        setChatMessages(chatData.reverse()); // Reverse to show oldest first

        // Join project room
        socketService.joinProject(projectId);

      } catch (err) {
        console.error('Failed to initialize collaboration:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize collaboration');
      } finally {
        setIsLoading(false);
      }
    };

    initializeCollaboration();

    return () => {
      socketService.leaveProject(projectId);
    };
  }, [token, projectId]);

  // Set up event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleProjectJoined = (data: any) => {
      setActiveSessions(data.activeSessions);
      
      // Initialize presence for active sessions
      const presenceMap = new Map<string, CollaboratorPresence>();
      data.activeSessions.forEach((session: any) => {
        presenceMap.set(session.sessionId, {
          sessionId: session.sessionId,
          userId: session.user.id,
          username: session.user.username,
          cursor: session.cursor,
          activeFile: session.activeFile,
          status: 'active',
          lastSeen: session.lastSeen,
        });
      });
      setCollaboratorPresence(presenceMap);
    };

    const handleUserJoined = (data: any) => {
      setActiveSessions(prev => [...prev, {
        sessionId: data.sessionId,
        user: data.user,
        cursor: null,
        activeFile: null,
        lastSeen: new Date().toISOString(),
      }]);

      setCollaboratorPresence(prev => {
        const newMap = new Map(prev);
        newMap.set(data.sessionId, {
          sessionId: data.sessionId,
          userId: data.user.id,
          username: data.user.username,
          status: 'active',
          lastSeen: new Date().toISOString(),
        });
        return newMap;
      });
    };

    const handleUserLeft = (data: any) => {
      setActiveSessions(prev => prev.filter(session => session.sessionId !== data.sessionId));
      setCollaboratorPresence(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.sessionId);
        return newMap;
      });
    };

    const handleCursorUpdate = (data: any) => {
      setCollaboratorPresence(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(data.sessionId);
        if (existing) {
          newMap.set(data.sessionId, {
            ...existing,
            cursor: data.cursor,
            lastSeen: new Date().toISOString(),
          });
        }
        return newMap;
      });

      onCursorUpdate?.(data.cursor, data.userId, data.username);
    };

    const handleTextChangeApplied = (data: any) => {
      onTextChange?.(data.change, data.userId, data.username);
    };

    const handleFileChanged = (data: any) => {
      onFileChange?.(data.filename, data.content, data.changeType, data.userId, data.username);
    };

    const handleChatMessage = (data: any) => {
      setChatMessages(prev => [...prev, data]);
    };

    const handlePresenceUpdate = (data: any) => {
      setCollaboratorPresence(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(data.sessionId);
        if (existing) {
          newMap.set(data.sessionId, {
            ...existing,
            status: data.status,
            lastSeen: data.timestamp,
          });
        }
        return newMap;
      });
    };

    const handleUserDisconnected = (data: any) => {
      setActiveSessions(prev => prev.filter(session => session.sessionId !== data.sessionId));
      setCollaboratorPresence(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.sessionId);
        return newMap;
      });
    };

    const handleError = (data: any) => {
      setError(data.message);
    };

    // Register event listeners
    socketService.on('project-joined', handleProjectJoined);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('cursor-update', handleCursorUpdate);
    socketService.on('text-change-applied', handleTextChangeApplied);
    socketService.on('file-changed', handleFileChanged);
    socketService.on('chat-message-received', handleChatMessage);
    socketService.on('presence-updated', handlePresenceUpdate);
    socketService.on('user-disconnected', handleUserDisconnected);
    socketService.on('error', handleError);

    return () => {
      // Cleanup event listeners
      socketService.off('project-joined', handleProjectJoined);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('cursor-update', handleCursorUpdate);
      socketService.off('text-change-applied', handleTextChangeApplied);
      socketService.off('file-changed', handleFileChanged);
      socketService.off('chat-message-received', handleChatMessage);
      socketService.off('presence-updated', handlePresenceUpdate);
      socketService.off('user-disconnected', handleUserDisconnected);
      socketService.off('error', handleError);
    };
  }, [isConnected, onTextChange, onFileChange, onCursorUpdate]);

  // Collaboration actions
  const inviteCollaborator = useCallback(async (userEmail: string, role: 'EDITOR' | 'VIEWER') => {
    try {
      const collaborator = await collaborationApi.inviteCollaborator(projectId, userEmail, role);
      setCollaborators(prev => [...prev, collaborator]);
      return collaborator;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
      throw err;
    }
  }, [projectId]);

  const removeCollaborator = useCallback(async (collaboratorId: string) => {
    try {
      await collaborationApi.removeCollaborator(projectId, collaboratorId);
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
      throw err;
    }
  }, [projectId]);

  const updateCollaboratorRole = useCallback(async (collaboratorId: string, role: 'EDITOR' | 'VIEWER') => {
    try {
      const updatedCollaborator = await collaborationApi.updateCollaboratorRole(projectId, collaboratorId, role);
      setCollaborators(prev => prev.map(c => c.id === collaboratorId ? updatedCollaborator : c));
      return updatedCollaborator;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collaborator role');
      throw err;
    }
  }, [projectId]);

  const sendChatMessage = useCallback((message: string) => {
    if (!isConnected) {
      setError('Not connected to collaboration server');
      return;
    }
    socketService.sendChatMessage(message);
  }, [isConnected]);

  const updateCursor = useCallback((cursor: CursorPosition) => {
    if (!isConnected) return;
    socketService.updateCursor(cursor);
  }, [isConnected]);

  const sendTextChange = useCallback((change: TextChange) => {
    if (!isConnected) return;
    socketService.sendTextChange(change);
  }, [isConnected]);

  const sendFileChange = useCallback((filename: string, content: string, changeType: 'create' | 'update' | 'delete') => {
    if (!isConnected) return;
    socketService.sendFileChange(filename, content, changeType);
  }, [isConnected]);

  const updatePresence = useCallback((status: 'active' | 'idle' | 'away') => {
    if (!isConnected) return;
    socketService.updatePresence(status);
  }, [isConnected]);

  const canEdit = userRole === 'OWNER' || userRole === 'EDITOR';
  const canManageCollaborators = userRole === 'OWNER';

  return {
    // State
    isConnected,
    isLoading,
    error,
    collaborators,
    activeSessions,
    collaboratorPresence: Array.from(collaboratorPresence.values()),
    chatMessages,
    userRole,
    canEdit,
    canManageCollaborators,

    // Actions
    inviteCollaborator,
    removeCollaborator,
    updateCollaboratorRole,
    sendChatMessage,
    updateCursor,
    sendTextChange,
    sendFileChange,
    updatePresence,

    // Utilities
    clearError: () => setError(null),
  };
};