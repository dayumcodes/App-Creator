import { renderHook, act } from '@testing-library/react';
import { useVersionControl } from '../useVersionControl';
import { api } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('useVersionControl', () => {
  const mockProjectId = 'project-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createVersion', () => {
    it('should create a version successfully', async () => {
      const mockVersion = {
        id: 'version-123',
        name: 'v1.0.0',
        description: 'Initial version',
        isActive: true,
        createdAt: '2024-01-25T10:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockVersion });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let createdVersion;
      await act(async () => {
        createdVersion = await result.current.createVersion('v1.0.0', 'Initial version');
      });

      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/versions`, {
        name: 'v1.0.0',
        description: 'Initial version',
      });
      expect(createdVersion).toEqual(mockVersion);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle create version error', async () => {
      const errorResponse = {
        response: { data: { error: 'Version name already exists' } },
      };
      mockApi.post.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      await act(async () => {
        try {
          await result.current.createVersion('v1.0.0');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Version name already exists');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('getVersionHistory', () => {
    it('should get version history successfully', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          name: 'v1.0.0',
          description: 'Initial version',
          isActive: false,
          createdAt: '2024-01-25T10:00:00Z',
        },
        {
          id: 'version-2',
          name: 'v1.1.0',
          description: 'Bug fixes',
          isActive: true,
          createdAt: '2024-01-25T11:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockVersions });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let versions;
      await act(async () => {
        versions = await result.current.getVersionHistory();
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/versions`);
      expect(versions).toEqual(mockVersions);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle get version history error', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let versions;
      await act(async () => {
        versions = await result.current.getVersionHistory();
      });

      expect(result.current.error).toBe('Failed to load version history');
      expect(versions).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to version successfully', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      await act(async () => {
        await result.current.rollbackToVersion('version-123');
      });

      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/versions/version-123/rollback`);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle rollback error', async () => {
      mockApi.post.mockRejectedValue(new Error('Rollback failed'));

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      await act(async () => {
        try {
          await result.current.rollbackToVersion('version-123');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Failed to rollback to version');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('getChangeHistory', () => {
    it('should get change history successfully', async () => {
      const mockChanges = [
        {
          id: 'change-1',
          filename: 'index.html',
          changeType: 'UPDATE' as const,
          createdAt: '2024-01-25T10:30:00Z',
        },
        {
          id: 'change-2',
          filename: 'style.css',
          changeType: 'CREATE' as const,
          createdAt: '2024-01-25T10:45:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockChanges });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let changes;
      await act(async () => {
        changes = await result.current.getChangeHistory(10, 0);
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/changes?limit=10&offset=0`);
      expect(changes).toEqual(mockChanges);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle change history without parameters', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      await act(async () => {
        await result.current.getChangeHistory();
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/changes?`);
    });
  });

  describe('undoLastChange', () => {
    it('should undo last change successfully', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let success;
      await act(async () => {
        success = await result.current.undoLastChange();
      });

      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/undo`);
      expect(success).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle no changes to undo', async () => {
      const errorResponse = {
        response: { status: 400, data: { error: 'No changes to undo' } },
      };
      mockApi.post.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let success;
      await act(async () => {
        success = await result.current.undoLastChange();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('No changes to undo');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('getUndoRedoState', () => {
    it('should get undo/redo state successfully', async () => {
      const mockState = {
        canUndo: true,
        canRedo: false,
        currentPosition: 5,
        totalChanges: 5,
      };

      mockApi.get.mockResolvedValue({ data: mockState });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let state;
      await act(async () => {
        state = await result.current.getUndoRedoState();
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/undo-state`);
      expect(state).toEqual(mockState);
    });

    it('should handle undo state error gracefully', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let state;
      await act(async () => {
        state = await result.current.getUndoRedoState();
      });

      expect(state).toEqual({
        canUndo: false,
        canRedo: false,
        currentPosition: 0,
        totalChanges: 0,
      });
    });
  });

  describe('compareVersions', () => {
    it('should compare versions successfully', async () => {
      const mockDiffs = [
        {
          filename: 'index.html',
          oldContent: '<html>Old</html>',
          newContent: '<html>New</html>',
          diff: '- <html>Old</html>\n+ <html>New</html>',
          changeType: 'UPDATE' as const,
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockDiffs });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let diffs;
      await act(async () => {
        diffs = await result.current.compareVersions('version-1', 'version-2');
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/compare/version-1/version-2`);
      expect(diffs).toEqual(mockDiffs);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('compareWithCurrentState', () => {
    it('should compare with current state successfully', async () => {
      const mockDiffs = [
        {
          filename: 'index.html',
          oldContent: '<html>Version</html>',
          newContent: '<html>Current</html>',
          diff: '- <html>Version</html>\n+ <html>Current</html>',
          changeType: 'UPDATE' as const,
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockDiffs });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let diffs;
      await act(async () => {
        diffs = await result.current.compareWithCurrentState('version-123');
      });

      expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/compare/version-123/current`);
      expect(diffs).toEqual(mockDiffs);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('createExperimentalBranch', () => {
    it('should create experimental branch successfully', async () => {
      const mockBranch = {
        id: 'branch-123',
        name: 'feature-experiment-20240125T120000',
        description: 'Experimental branch',
        isActive: true,
        createdAt: '2024-01-25T12:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockBranch });

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      let branch;
      await act(async () => {
        branch = await result.current.createExperimentalBranch('feature', 'Experimental branch');
      });

      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/branch`, {
        baseName: 'feature',
        description: 'Experimental branch',
      });
      expect(branch).toEqual(mockBranch);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useVersionControl(mockProjectId));

      // Set an error first
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should set loading state correctly', async () => {
      // Mock a slow API call
      mockApi.get.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve({ data: [] }), 100)
      ));

      const { result } = renderHook(() => useVersionControl(mockProjectId));

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.getVersionHistory();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
    });
  });
});