import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setHistory, clearHistory } from '../store/slices/promptSlice';
import { apiService } from '../services/api';

interface PromptHistoryProps {
  onSelect: (prompt: string) => void;
}

const PromptHistory: React.FC<PromptHistoryProps> = ({ onSelect }) => {
  const dispatch = useAppDispatch();
  const { currentProject } = useAppSelector((state) => state.project);
  const { history } = useAppSelector((state) => state.prompt);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentProject && history.length === 0) {
      loadHistory();
    }
  }, [currentProject]);

  const loadHistory = async () => {
    if (!currentProject) return;

    setIsLoading(true);
    try {
      const response = await apiService.getPromptHistory(currentProject.id);
      if (response && response.data) {
        dispatch(setHistory(response.data));
      }
    } catch (error) {
      console.error('Failed to load prompt history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all prompt history? This action cannot be undone.')) {
      dispatch(clearHistory());
    }
  };

  const filteredHistory = history.filter(item =>
    item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (!currentProject) {
    return (
      <div className="prompt-history">
        <div className="history-empty">
          <p>Select a project to view prompt history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-history">
      <div className="history-header">
        <h4>📝 Prompt History</h4>
        <div className="history-actions">
          <button
            className="btn btn-small"
            onClick={loadHistory}
            disabled={isLoading}
            title="Refresh history"
          >
            {isLoading ? '⟳' : '🔄'}
          </button>
          {history.length > 0 && (
            <button
              className="btn btn-small btn-danger"
              onClick={handleClearHistory}
              title="Clear all history"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="history-search">
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      <div className="history-content">
        {isLoading ? (
          <div className="history-loading">
            <div className="loading-spinner"></div>
            <p>Loading history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="history-empty">
            {searchQuery ? (
              <p>No prompts found matching "{searchQuery}"</p>
            ) : history.length === 0 ? (
              <>
                <div className="empty-icon">📝</div>
                <p>No prompt history yet</p>
                <p className="empty-subtitle">Your previous prompts will appear here</p>
              </>
            ) : (
              <p>No prompts found</p>
            )}
          </div>
        ) : (
          <div className="history-list">
            {filteredHistory.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-date">{formatDate(item.createdAt)}</span>
                  {item.filesChanged.length > 0 && (
                    <span className="files-changed">
                      {item.filesChanged.length} file{item.filesChanged.length !== 1 ? 's' : ''} changed
                    </span>
                  )}
                </div>
                
                <div className="history-prompt">
                  <p title={item.prompt}>
                    {truncateText(item.prompt, 120)}
                  </p>
                </div>

                {item.filesChanged.length > 0 && (
                  <div className="history-files">
                    <div className="files-list">
                      {item.filesChanged.slice(0, 3).map((filename, index) => (
                        <span key={index} className="file-tag">
                          {filename}
                        </span>
                      ))}
                      {item.filesChanged.length > 3 && (
                        <span className="file-tag more">
                          +{item.filesChanged.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="history-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onSelect(item.prompt)}
                    title="Use this prompt"
                  >
                    Use prompt
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() => {
                      navigator.clipboard.writeText(item.prompt);
                    }}
                    title="Copy prompt"
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-footer">
          <p className="history-info">
            Showing {filteredHistory.length} of {history.length} prompts
          </p>
        </div>
      )}
    </div>
  );
};

export default PromptHistory;