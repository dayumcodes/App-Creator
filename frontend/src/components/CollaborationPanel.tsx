import React, { useState } from 'react';
import { CollaboratorList } from './CollaboratorList';
import { CollaborationChat } from './CollaborationChat';
import { useCollaboration } from '../hooks/useCollaboration';
import './CollaborationPanel.css';

interface CollaborationPanelProps {
  projectId: string;
  currentUserId?: string;
  onTextChange?: (change: any, userId: string, username: string) => void;
  onFileChange?: (filename: string, content: string, changeType: 'create' | 'update' | 'delete', userId: string, username: string) => void;
  onCursorUpdate?: (cursor: any, userId: string, username: string) => void;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  projectId,
  currentUserId,
  onTextChange,
  onFileChange,
  onCursorUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'collaborators' | 'chat'>('collaborators');
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    isConnected,
    isLoading,
    error,
    collaborators,
    collaboratorPresence,
    chatMessages,
    userRole,
    canEdit,
    canManageCollaborators,
    inviteCollaborator,
    removeCollaborator,
    updateCollaboratorRole,
    sendChatMessage,
    clearError,
  } = useCollaboration({
    projectId,
    onTextChange,
    onFileChange,
    onCursorUpdate,
  });

  if (isLoading) {
    return (
      <div className="collaboration-panel loading">
        <div className="loading-spinner">Loading collaboration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collaboration-panel error">
        <div className="error-message">
          <p>Failed to load collaboration features</p>
          <p className="error-details">{error}</p>
          <button onClick={clearError} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const unreadMessages = chatMessages.filter(m => 
    m.user.id !== currentUserId && 
    new Date(m.timestamp) > new Date(Date.now() - 5 * 60 * 1000)
  ).length;

  const onlineCollaborators = collaboratorPresence.filter(p => p.status === 'active').length;

  if (!isExpanded) {
    return (
      <div className="collaboration-panel collapsed">
        <button
          className="expand-button"
          onClick={() => setIsExpanded(true)}
          title="Open collaboration panel"
        >
          <div className="collaboration-summary">
            <div className="summary-item">
              <span className="summary-icon">👥</span>
              <span className="summary-count">{onlineCollaborators}</span>
            </div>
            {unreadMessages > 0 && (
              <div className="summary-item">
                <span className="summary-icon">💬</span>
                <span className="summary-count unread">{unreadMessages}</span>
              </div>
            )}
            <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢' : '🔴'}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="collaboration-panel expanded">
      <div className="panel-header">
        <h2>Collaboration</h2>
        <div className="header-actions">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <button
            className="collapse-button"
            onClick={() => setIsExpanded(false)}
            title="Collapse panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'collaborators' ? 'active' : ''}`}
          onClick={() => setActiveTab('collaborators')}
        >
          Collaborators ({collaborators.length})
          {onlineCollaborators > 0 && (
            <span className="online-indicator">{onlineCollaborators} online</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
          {unreadMessages > 0 && (
            <span className="unread-badge">{unreadMessages}</span>
          )}
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'collaborators' && (
          <CollaboratorList
            collaborators={collaborators}
            collaboratorPresence={collaboratorPresence}
            userRole={userRole}
            onInviteCollaborator={inviteCollaborator}
            onRemoveCollaborator={removeCollaborator}
            onUpdateRole={updateCollaboratorRole}
          />
        )}

        {activeTab === 'chat' && (
          <div className="chat-container">
            <CollaborationChat
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              currentUserId={currentUserId}
              isConnected={isConnected}
            />
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="permission-notice">
          <p>👁️ You have view-only access to this project</p>
        </div>
      )}
    </div>
  );
};