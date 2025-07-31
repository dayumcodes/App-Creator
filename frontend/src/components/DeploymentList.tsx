import React, { useState } from 'react';
import { Deployment, DeploymentStatus, DeploymentPlatform } from '../services/deploymentApi';
import './DeploymentList.css';

interface DeploymentListProps {
  deployments: Deployment[];
  loading?: boolean;
  onRedeploy?: (deployment: Deployment) => void;
  onRollback?: (deployment: Deployment, targetDeployment: Deployment) => void;
  onDelete?: (deployment: Deployment) => void;
  onRefresh?: () => void;
}

export const DeploymentList: React.FC<DeploymentListProps> = ({
  deployments,
  loading = false,
  onRedeploy,
  onRollback,
  onDelete,
  onRefresh,
}) => {
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);

  const getStatusIcon = (status: DeploymentStatus) => {
    switch (status) {
      case DeploymentStatus.SUCCESS:
        return '✅';
      case DeploymentStatus.FAILED:
        return '❌';
      case DeploymentStatus.BUILDING:
        return '🔄';
      case DeploymentStatus.PENDING:
        return '⏳';
      case DeploymentStatus.CANCELLED:
        return '⏹️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: DeploymentStatus) => {
    switch (status) {
      case DeploymentStatus.SUCCESS:
        return 'success';
      case DeploymentStatus.FAILED:
        return 'error';
      case DeploymentStatus.BUILDING:
        return 'building';
      case DeploymentStatus.PENDING:
        return 'pending';
      case DeploymentStatus.CANCELLED:
        return 'cancelled';
      default:
        return 'unknown';
    }
  };

  const getPlatformIcon = (platform: DeploymentPlatform) => {
    switch (platform) {
      case DeploymentPlatform.NETLIFY:
        return '🌐';
      case DeploymentPlatform.VERCEL:
        return '▲';
      case DeploymentPlatform.GITHUB_PAGES:
        return '📄';
      default:
        return '🚀';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRollback = (deployment: Deployment) => {
    setSelectedDeployment(deployment.id);
    setShowRollbackModal(true);
  };

  const handleRollbackConfirm = (targetDeployment: Deployment) => {
    if (selectedDeployment && onRollback) {
      const currentDeployment = deployments.find(d => d.id === selectedDeployment);
      if (currentDeployment) {
        onRollback(currentDeployment, targetDeployment);
      }
    }
    setShowRollbackModal(false);
    setSelectedDeployment(null);
    setRollbackTarget(null);
  };

  const handleRollbackCancel = () => {
    setShowRollbackModal(false);
    setSelectedDeployment(null);
    setRollbackTarget(null);
  };

  const getSuccessfulDeployments = () => {
    return deployments.filter(d => 
      d.status === DeploymentStatus.SUCCESS && 
      d.id !== selectedDeployment
    );
  };

  if (loading && deployments.length === 0) {
    return (
      <div className="deployment-list loading">
        <div className="loading-spinner">Loading deployments...</div>
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="deployment-list empty">
        <div className="empty-state">
          <h3>No Deployments Yet</h3>
          <p>Deploy your project to see deployment history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deployment-list">
      <div className="deployment-list-header">
        <h3>Deployment History</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            {loading ? '🔄' : '↻'} Refresh
          </button>
        )}
      </div>

      <div className="deployments">
        {deployments.map((deployment) => (
          <div key={deployment.id} className="deployment-card">
            <div className="deployment-header">
              <div className="deployment-info">
                <div className="deployment-platform">
                  <span className="platform-icon">
                    {getPlatformIcon(deployment.platform)}
                  </span>
                  <span className="platform-name">{deployment.platform}</span>
                </div>
                <div className={`deployment-status status-${getStatusColor(deployment.status)}`}>
                  <span className="status-icon">{getStatusIcon(deployment.status)}</span>
                  <span className="status-text">{deployment.status}</span>
                </div>
              </div>
              <div className="deployment-date">
                {formatDate(deployment.createdAt)}
              </div>
            </div>

            {deployment.url && (
              <div className="deployment-url">
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="url-link"
                >
                  {deployment.url}
                </a>
              </div>
            )}

            {deployment.customDomain && (
              <div className="deployment-domain">
                <strong>Custom Domain:</strong> {deployment.customDomain}
              </div>
            )}

            {deployment.errorMessage && (
              <div className="deployment-error">
                <strong>Error:</strong> {deployment.errorMessage}
              </div>
            )}

            <div className="deployment-actions">
              {deployment.status === DeploymentStatus.SUCCESS && onRedeploy && (
                <button
                  onClick={() => onRedeploy(deployment)}
                  className="btn btn-secondary btn-sm"
                >
                  Redeploy
                </button>
              )}

              {deployment.status === DeploymentStatus.SUCCESS && 
               getSuccessfulDeployments().length > 0 && 
               onRollback && (
                <button
                  onClick={() => handleRollback(deployment)}
                  className="btn btn-secondary btn-sm"
                >
                  Rollback
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(deployment)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rollback Modal */}
      {showRollbackModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Select Deployment to Rollback To</h3>
              <button
                onClick={handleRollbackCancel}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Choose a previous successful deployment to rollback to:</p>
              <div className="rollback-options">
                {getSuccessfulDeployments().map((deployment) => (
                  <div
                    key={deployment.id}
                    className={`rollback-option ${rollbackTarget?.id === deployment.id ? 'selected' : ''}`}
                    onClick={() => setRollbackTarget(deployment)}
                  >
                    <div className="rollback-info">
                      <div className="rollback-platform">
                        {getPlatformIcon(deployment.platform)} {deployment.platform}
                      </div>
                      <div className="rollback-date">
                        {formatDate(deployment.createdAt)}
                      </div>
                    </div>
                    {deployment.url && (
                      <div className="rollback-url">{deployment.url}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={handleRollbackCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => rollbackTarget && handleRollbackConfirm(rollbackTarget)}
                className="btn btn-primary"
                disabled={!rollbackTarget}
              >
                Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};