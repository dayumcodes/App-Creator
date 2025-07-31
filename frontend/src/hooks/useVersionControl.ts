import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface ProjectVersion {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface FileChange {
  id: string;
  filename: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  createdAt: string;
}

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  currentPosition: number;
  totalChanges: number;
}

interface DiffResult {
  filename: string;
  oldContent: string;
  newContent: string;
  diff: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
}

export const useVersionControl = (projectId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((err: any, defaultMessage: string) => {
    console.error(err);
    setError(err.response?.data?.error || defaultMessage);
  }, []);

  // Version management
  const createVersion = useCallback(async (name: string, description?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/${projectId}/versions`, {
        name,
        description,
      });
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to create version');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getVersionHistory = useCallback(async (): Promise<ProjectVersion[]> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/${projectId}/versions`);
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to load version history');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getVersionWithFiles = useCallback(async (versionId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/${projectId}/versions/${versionId}`);
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to load version');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const rollbackToVersion = useCallback(async (versionId: string) => {
    try {
      setLoading(true);
      setError(null);
      await api.post(`/${projectId}/versions/${versionId}/rollback`);
    } catch (err) {
      handleError(err, 'Failed to rollback to version');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const deleteVersion = useCallback(async (versionId: string) => {
    try {
      setLoading(true);
      setError(null);
      await api.delete(`/${projectId}/versions/${versionId}`);
    } catch (err) {
      handleError(err, 'Failed to delete version');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  // Change tracking
  const getChangeHistory = useCallback(async (limit?: number, offset?: number): Promise<FileChange[]> => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      
      const response = await api.get(`/${projectId}/changes?${params.toString()}`);
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to load change history');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getFileChangeHistory = useCallback(async (
    filename: string,
    limit?: number,
    offset?: number
  ): Promise<FileChange[]> => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      
      const response = await api.get(
        `/${projectId}/changes/${encodeURIComponent(filename)}?${params.toString()}`
      );
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to load file change history');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  // Undo/Redo
  const undoLastChange = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await api.post(`/${projectId}/undo`);
      return true;
    } catch (err) {
      if (err.response?.status === 400) {
        setError('No changes to undo');
        return false;
      }
      handleError(err, 'Failed to undo change');
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getUndoRedoState = useCallback(async (): Promise<UndoRedoState> => {
    try {
      const response = await api.get(`/${projectId}/undo-state`);
      return response.data;
    } catch (err) {
      console.error('Failed to load undo state:', err);
      return {
        canUndo: false,
        canRedo: false,
        currentPosition: 0,
        totalChanges: 0,
      };
    }
  }, [projectId]);

  // Comparison
  const compareVersions = useCallback(async (
    versionId1: string,
    versionId2: string
  ): Promise<DiffResult[]> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/${projectId}/compare/${versionId1}/${versionId2}`);
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to compare versions');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const compareWithCurrentState = useCallback(async (versionId: string): Promise<DiffResult[]> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/${projectId}/compare/${versionId}/current`);
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to compare with current state');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  // Branching
  const createExperimentalBranch = useCallback(async (
    baseName: string,
    description?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/${projectId}/branch`, {
        baseName,
        description,
      });
      return response.data;
    } catch (err) {
      handleError(err, 'Failed to create experimental branch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  return {
    loading,
    error,
    clearError,
    
    // Version management
    createVersion,
    getVersionHistory,
    getVersionWithFiles,
    rollbackToVersion,
    deleteVersion,
    
    // Change tracking
    getChangeHistory,
    getFileChangeHistory,
    
    // Undo/Redo
    undoLastChange,
    getUndoRedoState,
    
    // Comparison
    compareVersions,
    compareWithCurrentState,
    
    // Branching
    createExperimentalBranch,
  };
};