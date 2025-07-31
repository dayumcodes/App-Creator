import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './DiffViewer.css';

interface DiffResult {
  filename: string;
  oldContent: string;
  newContent: string;
  diff: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
}

interface DiffViewerProps {
  projectId: string;
  versionId1?: string;
  versionId2?: string;
  compareWithCurrent?: boolean;
  onClose?: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  projectId,
  versionId1,
  versionId2,
  compareWithCurrent = false,
  onClose,
}) => {
  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  useEffect(() => {
    loadDiffs();
  }, [projectId, versionId1, versionId2, compareWithCurrent]);

  const loadDiffs = async () => {
    try {
      setLoading(true);
      setError(null);

      let url: string;
      if (compareWithCurrent && versionId1) {
        url = `/${projectId}/compare/${versionId1}/current`;
      } else if (versionId1 && versionId2) {
        url = `/${projectId}/compare/${versionId1}/${versionId2}`;
      } else {
        throw new Error('Invalid comparison parameters');
      }

      const response = await api.get(url);
      setDiffs(response.data);
      
      // Auto-select first file with changes
      const firstChangedFile = response.data.find((diff: DiffResult) => 
        diff.changeType !== 'UPDATE' || diff.oldContent !== diff.newContent
      );
      if (firstChangedFile) {
        setSelectedFile(firstChangedFile.filename);
      }
    } catch (err) {
      setError('Failed to load diff');
      console.error('Error loading diff:', err);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'CREATE':
        return '#28a745';
      case 'DELETE':
        return '#dc3545';
      case 'UPDATE':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'CREATE':
        return '➕';
      case 'DELETE':
        return '🗑️';
      case 'UPDATE':
        return '✏️';
      default:
        return '📝';
    }
  };

  const renderUnifiedDiff = (diff: DiffResult) => {
    const lines = diff.diff.split('\n');
    return (
      <div className="unified-diff">
        {lines.map((line, index) => {
          let className = 'diff-line';
          if (line.startsWith('+')) {
            className += ' added';
          } else if (line.startsWith('-')) {
            className += ' removed';
          } else {
            className += ' unchanged';
          }

          return (
            <div key={index} className={className}>
              <span className="line-number">{index + 1}</span>
              <span className="line-content">{line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSideBySideDiff = (diff: DiffResult) => {
    const oldLines = diff.oldContent.split('\n');
    const newLines = diff.newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="side-by-side-diff">
        <div className="diff-column old-content">
          <div className="column-header">Old Version</div>
          {Array.from({ length: maxLines }, (_, index) => (
            <div key={index} className="diff-line">
              <span className="line-number">{index + 1}</span>
              <span className="line-content">{oldLines[index] || ''}</span>
            </div>
          ))}
        </div>
        <div className="diff-column new-content">
          <div className="column-header">New Version</div>
          {Array.from({ length: maxLines }, (_, index) => (
            <div key={index} className="diff-line">
              <span className="line-number">{index + 1}</span>
              <span className="line-content">{newLines[index] || ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedDiff = diffs.find(diff => diff.filename === selectedFile);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <h3>Compare Versions</h3>
        <div className="diff-viewer-controls">
          <div className="view-mode-toggle">
            <button
              className={viewMode === 'side-by-side' ? 'active' : ''}
              onClick={() => setViewMode('side-by-side')}
            >
              Side by Side
            </button>
            <button
              className={viewMode === 'unified' ? 'active' : ''}
              onClick={() => setViewMode('unified')}
            >
              Unified
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">Loading diff...</div>
      )}

      {!loading && !error && (
        <div className="diff-viewer-content">
          <div className="file-list">
            <h4>Changed Files ({diffs.length})</h4>
            {diffs.map((diff) => (
              <div
                key={diff.filename}
                className={`file-item ${selectedFile === diff.filename ? 'selected' : ''}`}
                onClick={() => setSelectedFile(diff.filename)}
              >
                <span 
                  className="change-icon"
                  style={{ color: getChangeTypeColor(diff.changeType) }}
                >
                  {getChangeTypeIcon(diff.changeType)}
                </span>
                <span className="filename">{diff.filename}</span>
                <span 
                  className="change-type"
                  style={{ backgroundColor: getChangeTypeColor(diff.changeType) }}
                >
                  {diff.changeType}
                </span>
              </div>
            ))}
            {diffs.length === 0 && (
              <div className="no-changes">No changes found</div>
            )}
          </div>

          <div className="diff-content">
            {selectedDiff ? (
              <div>
                <div className="diff-header">
                  <h4>{selectedDiff.filename}</h4>
                  <span 
                    className="change-badge"
                    style={{ backgroundColor: getChangeTypeColor(selectedDiff.changeType) }}
                  >
                    {selectedDiff.changeType}
                  </span>
                </div>
                
                {selectedDiff.changeType === 'CREATE' && (
                  <div className="file-created">
                    <div className="info-message">File was created</div>
                    <pre className="code-content">{selectedDiff.newContent}</pre>
                  </div>
                )}
                
                {selectedDiff.changeType === 'DELETE' && (
                  <div className="file-deleted">
                    <div className="info-message">File was deleted</div>
                    <pre className="code-content deleted">{selectedDiff.oldContent}</pre>
                  </div>
                )}
                
                {selectedDiff.changeType === 'UPDATE' && (
                  <div className="file-updated">
                    {viewMode === 'unified' 
                      ? renderUnifiedDiff(selectedDiff)
                      : renderSideBySideDiff(selectedDiff)
                    }
                  </div>
                )}
              </div>
            ) : (
              <div className="no-file-selected">
                Select a file to view changes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};