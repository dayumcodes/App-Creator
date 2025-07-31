import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './VersionHistory.css';

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

interface VersionHistoryProps {
  projectId: string;
  onVersionSelect?: (version: ProjectVersion) => void;
  onRollback?: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  projectId,
  onVersionSelect,
  onRollback,
}) => {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [undoState, setUndoState] = useState<UndoRedoState>({
    canUndo: false,
    canRedo: false,
    currentPosition: 0,
    totalChanges: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'versions' | 'changes'>('versions');
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');

  useEffect(() => {
    loadVersionHistory();
    loadChangeHistory();
    loadUndoState();
  }, [projectId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/${projectId}/versions`);
      setVersions(response.data);
    } catch (err) {
      setError('Failed to load version history');
      console.error('Error loading version history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChangeHistory = async () => {
    try {
      const response = await api.get(`/${projectId}/changes?limit=20`);
      setChanges(response.data);
    } catch (err) {
      console.error('Error loading change history:', err);
    }
  };

  const loadUndoState = async () => {
    try {
      const response = await api.get(`/${projectId}/undo-state`);
      setUndoState(response.data);
    } catch (err) {
      console.error('Error loading undo state:', err);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) {
      setError('Version name is required');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/${projectId}/versions`, {
        name: newVersionName,
        description: newVersionDescription,
      });
      
      setNewVersionName('');
      setNewVersionDescription('');
      setShowCreateVersion(false);
      await loadVersionHistory();
    } catch (err) {
      setError('Failed to create version');
      console.error('Error creating version:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!window.confirm('Are you sure you want to rollback to this version? This will overwrite your current changes.')) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/${projectId}/versions/${versionId}/rollback`);
      await loadVersionHistory();
      await loadChangeHistory();
      await loadUndoState();
      onRollback?.();
    } catch (err) {
      setError('Failed to rollback to version');
      console.error('Error rolling back:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    try {
      setLoading(true);
      await api.post(`/${projectId}/undo`);
      await loadChangeHistory();
      await loadUndoState();
      onRollback?.(); // Refresh the editor
    } catch (err) {
      setError('Failed to undo change');
      console.error('Error undoing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    const baseName = prompt('Enter branch name:');
    if (!baseName) return;

    try {
      setLoading(true);
      await api.post(`/${projectId}/branch`, {
        baseName,
        description: 'Experimental branch',
      });
      await loadVersionHistory();
    } catch (err) {
      setError('Failed to create branch');
      console.error('Error creating branch:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'CREATE':
        return '➕';
      case 'UPDATE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
      default:
        return '📝';
    }
  };

  return (
    <div className="version-history">
      <div className="version-history-header">
        <h3>Version Control</h3>
        <div className="version-history-actions">
          <button
            onClick={handleUndo}
            disabled={!undoState.canUndo || loading}
            className="undo-btn"
            title="Undo last change"
          >
            ↶ Undo
          </button>
          <button
            onClick={() => setShowCreateVersion(true)}
            className="create-version-btn"
            disabled={loading}
          >
            📸 Save Version
          </button>
          <button
            onClick={handleCreateBranch}
            className="create-branch-btn"
            disabled={loading}
          >
            🌿 Create Branch
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="version-history-tabs">
        <button
          className={`tab ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          Versions ({versions.length})
        </button>
        <button
          className={`tab ${activeTab === 'changes' ? 'active' : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          Changes ({undoState.totalChanges})
        </button>
      </div>

      {showCreateVersion && (
        <div className="create-version-modal">
          <div className="modal-content">
            <h4>Create New Version</h4>
            <input
              type="text"
              placeholder="Version name"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="version-name-input"
            />
            <textarea
              placeholder="Description (optional)"
              value={newVersionDescription}
              onChange={(e) => setNewVersionDescription(e.target.value)}
              className="version-description-input"
            />
            <div className="modal-actions">
              <button onClick={handleCreateVersion} disabled={loading}>
                Create
              </button>
              <button onClick={() => setShowCreateVersion(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="version-history-content">
        {activeTab === 'versions' && (
          <div className="versions-list">
            {loading && <div className="loading">Loading versions...</div>}
            {versions.map((version) => (
              <div
                key={version.id}
                className={`version-item ${version.isActive ? 'active' : ''}`}
                onClick={() => onVersionSelect?.(version)}
              >
                <div className="version-header">
                  <span className="version-name">{version.name}</span>
                  {version.isActive && <span className="active-badge">Current</span>}
                </div>
                {version.description && (
                  <div className="version-description">{version.description}</div>
                )}
                <div className="version-meta">
                  <span className="version-date">{formatDate(version.createdAt)}</span>
                  {!version.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRollback(version.id);
                      }}
                      className="rollback-btn"
                      disabled={loading}
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </div>
            ))}
            {versions.length === 0 && !loading && (
              <div className="empty-state">
                No versions yet. Create your first version to save the current state.
              </div>
            )}
          </div>
        )}

        {activeTab === 'changes' && (
          <div className="changes-list">
            {loading && <div className="loading">Loading changes...</div>}
            {changes.map((change) => (
              <div key={change.id} className="change-item">
                <div className="change-header">
                  <span className="change-icon">
                    {getChangeTypeIcon(change.changeType)}
                  </span>
                  <span className="change-filename">{change.filename}</span>
                  <span className="change-type">{change.changeType}</span>
                </div>
                <div className="change-date">{formatDate(change.createdAt)}</div>
              </div>
            ))}
            {changes.length === 0 && !loading && (
              <div className="empty-state">
                No changes yet. Start editing files to see change history.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};