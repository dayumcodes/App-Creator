import React, { useState } from 'react';
import { Collaborator } from '../services/collaborationApi';
import { CollaboratorPresence } from '../hooks/useCollaboration';
import './CollaboratorList.css';

interface CollaboratorListProps {
  collaborators: Collaborator[];
  collaboratorPresence: CollaboratorPresence[];
  userRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  onInviteCollaborator: (email: string, role: 'EDITOR' | 'VIEWER') => Promise<void>;
  onRemoveCollaborator: (collaboratorId: string) => Promise<void>;
  onUpdateRole: (collaboratorId: string, role: 'EDITOR' | 'VIEWER') => Promise<void>;
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  collaborators,
  collaboratorPresence,
  userRole,
  onInviteCollaborator,
  onRemoveCollaborator,
  onUpdateRole,
}) => {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);

  const getPresenceStatus = (userId: string) => {
    const presence = collaboratorPresence.find(p => p.userId === userId);
    return presence?.status || 'offline';
  };

  const getPresenceIndicator = (status: string) => {
    const indicators = {
      active: '🟢',
      idle: '🟡',
      away: '🔴',
      offline: '⚫',
    };
    return indicators[status as keyof typeof indicators] || '⚫';
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await onInviteCollaborator(inviteEmail, inviteRole);
      setInviteEmail('');
      setShowInviteForm(false);
    } catch (error) {
      console.error('Failed to invite collaborator:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (collaboratorId: string, newRole: 'EDITOR' | 'VIEWER') => {
    try {
      await onUpdateRole(collaboratorId, newRole);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemove = async (collaboratorId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;
    
    try {
      await onRemoveCollaborator(collaboratorId);
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
    }
  };

  const canManageCollaborators = userRole === 'OWNER';

  return (
    <div className="collaborator-list">
      <div className="collaborator-list-header">
        <h3>Collaborators ({collaborators.length})</h3>
        {canManageCollaborators && (
          <button
            className="invite-button"
            onClick={() => setShowInviteForm(!showInviteForm)}
          >
            + Invite
          </button>
        )}
      </div>

      {showInviteForm && (
        <form className="invite-form" onSubmit={handleInvite}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={isInviting}>
              {isInviting ? 'Inviting...' : 'Send Invite'}
            </button>
            <button type="button" onClick={() => setShowInviteForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="collaborator-items">
        {collaborators.map((collaborator) => {
          const presenceStatus = getPresenceStatus(collaborator.user.id);
          const isOnline = presenceStatus !== 'offline';

          return (
            <div key={collaborator.id} className="collaborator-item">
              <div className="collaborator-info">
                <div className="collaborator-avatar">
                  <span className="presence-indicator">
                    {getPresenceIndicator(presenceStatus)}
                  </span>
                  <div className="avatar">
                    {collaborator.user.username.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="collaborator-details">
                  <div className="collaborator-name">
                    {collaborator.user.username}
                    {isOnline && <span className="online-badge">Online</span>}
                  </div>
                  <div className="collaborator-email">{collaborator.user.email}</div>
                </div>
              </div>

              <div className="collaborator-actions">
                {canManageCollaborators && collaborator.role !== 'OWNER' ? (
                  <>
                    <select
                      value={collaborator.role}
                      onChange={(e) => handleRoleChange(collaborator.id, e.target.value as 'EDITOR' | 'VIEWER')}
                      className="role-select"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                    <button
                      className="remove-button"
                      onClick={() => handleRemove(collaborator.id)}
                      title="Remove collaborator"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span className="role-badge role-{collaborator.role.toLowerCase()}">
                    {collaborator.role}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {collaborators.length === 0 && (
        <div className="empty-state">
          <p>No collaborators yet.</p>
          {canManageCollaborators && (
            <p>Invite team members to start collaborating!</p>
          )}
        </div>
      )}
    </div>
  );
};