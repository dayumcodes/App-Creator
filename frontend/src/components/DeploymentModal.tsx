import React, { useState } from 'react';
import { Modal } from './Modal';
import { DeploymentPlatform, CreateDeploymentRequest } from '../services/deploymentApi';
import './DeploymentModal.css';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (data: CreateDeploymentRequest) => Promise<void>;
  projectId: string;
  loading?: boolean;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
  projectId,
  loading = false,
}) => {
  const [platform, setPlatform] = useState<DeploymentPlatform>(DeploymentPlatform.NETLIFY);
  const [customDomain, setCustomDomain] = useState('');
  const [buildCommand, setBuildCommand] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (customDomain && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/.test(customDomain)) {
      newErrors.customDomain = 'Please enter a valid domain name';
    }

    // Validate environment variables
    const envVarKeys = new Set<string>();
    envVars.forEach((envVar, index) => {
      if (envVar.key && !envVar.value) {
        newErrors[`envVar_${index}_value`] = 'Value is required when key is provided';
      }
      if (envVar.value && !envVar.key) {
        newErrors[`envVar_${index}_key`] = 'Key is required when value is provided';
      }
      if (envVar.key && envVarKeys.has(envVar.key)) {
        newErrors[`envVar_${index}_key`] = 'Duplicate environment variable key';
      }
      if (envVar.key) {
        envVarKeys.add(envVar.key);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const envVarsObject = envVars
      .filter(envVar => envVar.key && envVar.value)
      .reduce((acc, envVar) => {
        acc[envVar.key] = envVar.value;
        return acc;
      }, {} as Record<string, string>);

    const deploymentData: CreateDeploymentRequest = {
      projectId,
      platform,
      customDomain: customDomain.trim() || undefined,
      buildCommand: buildCommand.trim() || undefined,
      outputDir: outputDir.trim() || undefined,
      envVars: Object.keys(envVarsObject).length > 0 ? envVarsObject : undefined,
    };

    try {
      await onDeploy(deploymentData);
      handleClose();
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  };

  const handleClose = () => {
    setPlatform(DeploymentPlatform.NETLIFY);
    setCustomDomain('');
    setBuildCommand('');
    setOutputDir('');
    setEnvVars([]);
    setErrors({});
    onClose();
  };

  const getPlatformInfo = (platform: DeploymentPlatform) => {
    switch (platform) {
      case DeploymentPlatform.NETLIFY:
        return {
          name: 'Netlify',
          description: 'Deploy to Netlify with automatic builds and CDN',
          defaultBuildCommand: 'npm run build',
          defaultOutputDir: 'dist',
        };
      case DeploymentPlatform.VERCEL:
        return {
          name: 'Vercel',
          description: 'Deploy to Vercel with edge functions and global CDN',
          defaultBuildCommand: 'npm run build',
          defaultOutputDir: 'dist',
        };
      case DeploymentPlatform.GITHUB_PAGES:
        return {
          name: 'GitHub Pages',
          description: 'Deploy to GitHub Pages with free hosting',
          defaultBuildCommand: '',
          defaultOutputDir: '',
        };
    }
  };

  const platformInfo = getPlatformInfo(platform);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Deploy Project">
      <form onSubmit={handleSubmit} className="deployment-form">
        <div className="form-group">
          <label htmlFor="platform">Deployment Platform</label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as DeploymentPlatform)}
            className="form-control"
          >
            <option value={DeploymentPlatform.NETLIFY}>Netlify</option>
            <option value={DeploymentPlatform.VERCEL}>Vercel</option>
            <option value={DeploymentPlatform.GITHUB_PAGES}>GitHub Pages</option>
          </select>
          <small className="form-help">{platformInfo.description}</small>
        </div>

        <div className="form-group">
          <label htmlFor="customDomain">Custom Domain (Optional)</label>
          <input
            type="text"
            id="customDomain"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="example.com"
            className={`form-control ${errors.customDomain ? 'error' : ''}`}
          />
          {errors.customDomain && (
            <small className="error-message">{errors.customDomain}</small>
          )}
        </div>

        {platform !== DeploymentPlatform.GITHUB_PAGES && (
          <>
            <div className="form-group">
              <label htmlFor="buildCommand">Build Command (Optional)</label>
              <input
                type="text"
                id="buildCommand"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder={platformInfo.defaultBuildCommand}
                className="form-control"
              />
              <small className="form-help">
                Command to build your project (leave empty for static files)
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="outputDir">Output Directory (Optional)</label>
              <input
                type="text"
                id="outputDir"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder={platformInfo.defaultOutputDir}
                className="form-control"
              />
              <small className="form-help">
                Directory containing built files (leave empty for root)
              </small>
            </div>
          </>
        )}

        <div className="form-group">
          <label>Environment Variables (Optional)</label>
          <div className="env-vars-container">
            {envVars.map((envVar, index) => (
              <div key={index} className="env-var-row">
                <input
                  type="text"
                  value={envVar.key}
                  onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                  placeholder="KEY"
                  className={`form-control ${errors[`envVar_${index}_key`] ? 'error' : ''}`}
                />
                <input
                  type="text"
                  value={envVar.value}
                  onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                  placeholder="value"
                  className={`form-control ${errors[`envVar_${index}_value`] ? 'error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveEnvVar(index)}
                  className="btn btn-danger btn-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddEnvVar}
              className="btn btn-secondary btn-sm"
            >
              Add Environment Variable
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </form>
    </Modal>
  );
};