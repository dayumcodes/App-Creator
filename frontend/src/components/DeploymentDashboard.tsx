import React, { useState } from 'react';
import { DeploymentModal } from './DeploymentModal';
import { DeploymentList } from './DeploymentList';
import { useDeployment } from '../hooks/useDeployment';
import { CreateDeploymentRequest, Deployment, DeploymentPlatform } from '../services/deploymentApi';
import './DeploymentDashboard.css';

interface DeploymentDashboardProps {
  projectId: string;
}

export const DeploymentDashboard: React.FC<DeploymentDashboardProps> = ({
  projectId,
}) => {
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const {
    deployments,
    activeDeployments,
    loading,
    error,
    createDeployment,
    redeployProject,
    rollbackDeployment,
    deleteDeployment,
    refreshDeployments,
  } = useDeployment(projectId);

  const handleDeploy = async (data: CreateDeploymentRequest) => {
    setDeploymentError(null);
    const deployment = await createDeployment(data);
    if (!deployment) {
      setDeploymentError('Failed to create deployment');
      throw new Error('Failed to create deployment');
    }
  };

  const handleRedeploy = async (deployment: Deployment) => {
    setDeploymentError(null);
    const newDeployment = await redeployProject(deployment.projectId, deployment.platform);
    if (!newDeployment) {
      setDeploymentError('Failed to redeploy project');
    }
  };

  const handleRollback = async (deployment: Deployment, targetDeployment: Deployment) => {
    setDeploymentError(null);
    const rolledBackDeployment = await rollbackDeployment(deployment.id, targetDeployment.id);
    if (!rolledBackDeployment) {
      setDeploymentError('Failed to rollback deployment');
    }
  };

  const handleDelete = async (deployment: Deployment) => {
    if (!window.confirm('Are you sure you want to delete this deployment? This action cannot be undone.')) {
      return;
    }

    setDeploymentError(null);
    const success = await deleteDeployment(deployment.id);
    if (!success) {
      setDeploymentError('Failed to delete deployment');
    }
  };

  const getQuickDeployPlatforms = (): DeploymentPlatform[] => {
    const usedPlatforms = new Set(activeDeployments.map(d => d.platform));
    return Object.values(DeploymentPlatform).filter(platform => !usedPlatforms.has(platform));
  };

  const handleQuickDeploy = async (platform: DeploymentPlatform) => {
    const deploymentData: CreateDeploymentRequest = {
      projectId,
      platform,
    };

    await handleDeploy(deploymentData);
  };

  return (
    <div className="deployment-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h2>Deployments</h2>
          <p>Deploy your project to various hosting platforms</p>
        </div>
        <button
          onClick={() => setShowDeployModal(true)}
          className="btn btn-primary"
          disabled={loading}
        >
          New Deployment
        </button>
      </div>

      {(error || deploymentError) && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error || deploymentError}</span>
          <button
            onClick={() => {
              setDeploymentError(null);
            }}
            className="error-close"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Deployments */}
      {activeDeployments.length > 0 && (
        <div className="active-deployments">
          <h3>Active Deployments</h3>
          <div className="active-deployment-cards">
            {activeDeployments.map((deployment) => (
              <div key={deployment.id} className="active-deployment-card">
                <div className="active-deployment-header">
                  <div className="platform-info">
                    <span className="platform-icon">
                      {deployment.platform === DeploymentPlatform.NETLIFY && '🌐'}
                      {deployment.platform === DeploymentPlatform.VERCEL && '▲'}
                      {deployment.platform === DeploymentPlatform.GITHUB_PAGES && '📄'}
                    </span>
                    <span className="platform-name">{deployment.platform}</span>
                  </div>
                  <div className="deployment-status success">
                    <span>✅ Live</span>
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
                  <div className="custom-domain">
                    <strong>Custom Domain:</strong> {deployment.customDomain}
                  </div>
                )}

                <div className="deployment-actions">
                  <button
                    onClick={() => handleRedeploy(deployment)}
                    className="btn btn-secondary btn-sm"
                    disabled={loading}
                  >
                    Redeploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Deploy */}
      {getQuickDeployPlatforms().length > 0 && (
        <div className="quick-deploy">
          <h3>Quick Deploy</h3>
          <p>Deploy to platforms you haven't used yet with default settings</p>
          <div className="quick-deploy-buttons">
            {getQuickDeployPlatforms().map((platform) => (
              <button
                key={platform}
                onClick={() => handleQuickDeploy(platform)}
                className="btn btn-outline"
                disabled={loading}
              >
                <span className="platform-icon">
                  {platform === DeploymentPlatform.NETLIFY && '🌐'}
                  {platform === DeploymentPlatform.VERCEL && '▲'}
                  {platform === DeploymentPlatform.GITHUB_PAGES && '📄'}
                </span>
                Deploy to {platform}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Deployment History */}
      <DeploymentList
        deployments={deployments}
        loading={loading}
        onRedeploy={handleRedeploy}
        onRollback={handleRollback}
        onDelete={handleDelete}
        onRefresh={refreshDeployments}
      />

      {/* Deploy Modal */}
      <DeploymentModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        onDeploy={handleDeploy}
        projectId={projectId}
        loading={loading}
      />
    </div>
  );
};