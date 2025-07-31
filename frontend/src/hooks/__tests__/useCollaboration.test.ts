import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { useCollaboration } from '../useCollaboration';
import { socketService } from '../../services/socketService';
import { collaborationApi } from '../../services/collaborationApi';
import authSlice from '../../store/slices/authSlice';

// Mock the services
vi.mock('../../services/socketService');
vi.mock('../../services/collaborationApi');

const mockSocketService = socketService as any;
const mockCollaborationApi = collaborationApi as any;

const createMockStore = (authState = { token: 'mock-token', user: null, isAuthenticated: true }) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: {
      auth: authState,
    },
  });
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createMockStore()}>{children}</Provider>
);

describe('useCollaboration', () => {
  const mockProjectId = 'project-1';
  const mockCollaborators = [
    {
      id: 'collab-1',
      user: { id: 'user-1', username: 'user1', email: 'user1@example.com' },
      role: 'OWNER' as const,
      invitedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    },
  ];

  const mockChatMessages = [
    {
      id: 'msg-1',
      message: 'Hello team!',
      timestamp: '2023-01-01T00:00:00Z',
      user: { id: 'user-1', username: 'user1' },
      isEdited: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockSocketService.connect = vi.fn().mockResolvedValue(undefined);
    mockSocketService.joinProject = vi.fn();
    mockSocketService.leaveProject = vi.fn();
    mockSocketService.on = vi.fn();
    mockSocketService.off = vi.fn();
    
    mockCollaborationApi.getCollaborators = vi.fn().mockResolvedValue(mockCollaborators);
    mockCollaborationApi.getUserRole = vi.fn().mockResolvedValue('OWNER');
    mockCollaborationApi.getChatMessages = vi.fn().mockResolvedValue(mockChatMessages);
  });

  it('should initialize collaboration successfully', async () => {
    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSocketService.connect).toHaveBeenCalledWith('mock-token');
    expect(mockSocketService.joinProject).toHaveBeenCalledWith(mockProjectId);
    expect(mockCollaborationApi.getCollaborators).toHaveBeenCalledWith(mockProjectId);
    expect(mockCollaborationApi.getUserRole).toHaveBeenCalledWith(mockProjectId);
    expect(mockCollaborationApi.getChatMessages).toHaveBeenCalledWith(mockProjectId, 50, 0);

    expect(result.current.collaborators).toEqual(mockCollaborators);
    expect(result.current.chatMessages).toEqual(mockChatMessages);
    expect(result.current.userRole).toBe('OWNER');
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canManageCollaborators).toBe(true);
  });

  it('should handle initialization error', async () => {
    const errorMessage = 'Failed to connect';
    mockSocketService.connect = vi.fn().mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('should invite collaborator successfully', async () => {
    const newCollaborator = {
      id: 'collab-2',
      user: { id: 'user-2', username: 'user2', email: 'user2@example.com' },
      role: 'EDITOR' as const,
      invitedAt: '2023-01-01T00:00:00Z',
      isActive: false,
    };

    mockCollaborationApi.inviteCollaborator = vi.fn().mockResolvedValue(newCollaborator);

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const collaborator = await result.current.inviteCollaborator('user2@example.com', 'EDITOR');
      expect(collaborator).toEqual(newCollaborator);
    });

    expect(mockCollaborationApi.inviteCollaborator).toHaveBeenCalledWith(
      mockProjectId,
      'user2@example.com',
      'EDITOR'
    );

    expect(result.current.collaborators).toHaveLength(2);
    expect(result.current.collaborators[1]).toEqual(newCollaborator);
  });

  it('should remove collaborator successfully', async () => {
    mockCollaborationApi.removeCollaborator = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.removeCollaborator('collab-1');
    });

    expect(mockCollaborationApi.removeCollaborator).toHaveBeenCalledWith(
      mockProjectId,
      'collab-1'
    );

    expect(result.current.collaborators).toHaveLength(0);
  });

  it('should send chat message', async () => {
    mockSocketService.isConnected = true;

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.sendChatMessage('Hello world!');
    });

    expect(mockSocketService.sendChatMessage).toHaveBeenCalledWith('Hello world!');
  });

  it('should handle socket events', async () => {
    const mockOnTextChange = vi.fn();
    const mockOnFileChange = vi.fn();
    const mockOnCursorUpdate = vi.fn();

    let eventHandlers: { [key: string]: Function } = {};

    mockSocketService.on = vi.fn().mockImplementation((event: string, handler: Function) => {
      eventHandlers[event] = handler;
    });

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
        onTextChange: mockOnTextChange,
        onFileChange: mockOnFileChange,
        onCursorUpdate: mockOnCursorUpdate,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate text change event
    act(() => {
      eventHandlers['text-change-applied']({
        change: { filename: 'test.js', operations: [], version: 1 },
        userId: 'user-2',
        username: 'user2',
      });
    });

    expect(mockOnTextChange).toHaveBeenCalledWith(
      { filename: 'test.js', operations: [], version: 1 },
      'user-2',
      'user2'
    );

    // Simulate file change event
    act(() => {
      eventHandlers['file-changed']({
        filename: 'test.js',
        content: 'console.log("hello");',
        changeType: 'update',
        userId: 'user-2',
        username: 'user2',
      });
    });

    expect(mockOnFileChange).toHaveBeenCalledWith(
      'test.js',
      'console.log("hello");',
      'update',
      'user-2',
      'user2'
    );

    // Simulate cursor update event
    act(() => {
      eventHandlers['cursor-update']({
        cursor: { filename: 'test.js', line: 1, column: 5 },
        userId: 'user-2',
        username: 'user2',
      });
    });

    expect(mockOnCursorUpdate).toHaveBeenCalledWith(
      { filename: 'test.js', line: 1, column: 5 },
      'user-2',
      'user2'
    );
  });

  it('should handle user permissions correctly', async () => {
    // Test EDITOR role
    mockCollaborationApi.getUserRole = vi.fn().mockResolvedValue('EDITOR');

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userRole).toBe('EDITOR');
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canManageCollaborators).toBe(false);
  });

  it('should handle VIEWER role permissions', async () => {
    mockCollaborationApi.getUserRole = vi.fn().mockResolvedValue('VIEWER');

    const { result } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userRole).toBe('VIEWER');
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canManageCollaborators).toBe(false);
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(
      () => useCollaboration({
        projectId: mockProjectId,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    expect(mockSocketService.leaveProject).toHaveBeenCalledWith(mockProjectId);
  });
});