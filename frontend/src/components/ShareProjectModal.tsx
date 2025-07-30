import React, { useState } from 'react';
import { type Project } from '../services/api';
import Modal from './Modal';

interface ShareProjectModalProps {
  project: Project;
  onClose: () => void;
}

const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  project,
  onClose,
}) => {
  const [shareUrl] = useState(`${window.location.origin}/projects/${project.id}/view`);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal onClose={onClose} title="Share Project" size="medium">
      <div className="share-project-modal">
        <div className="share-section">
          <h3>Project Information</h3>
          <div className="project-summary">
            <div className="summary-item">
              <span className="label">Name:</span>
              <span className="value">{project.name}</span>
            </div>
            {project.description && (
              <div className="summary-item">
                <span className="label">Description:</span>
                <span className="value">{project.description}</span>
              </div>
            )}
            <div className="summary-item">
              <span className="label">Files:</span>
              <span className="value">
                {project.files.length} file{project.files.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="share-section">
          <h3>Share Link</h3>
          <p className="share-description">
            Anyone with this link will be able to view your project (read-only).
          </p>
          <div className="share-url-container">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="share-url-input"
            />
            <button
              onClick={handleCopyUrl}
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="share-section">
          <h3>Collaboration (Coming Soon)</h3>
          <div className="coming-soon">
            <p>Real-time collaboration features are coming soon:</p>
            <ul>
              <li>Invite team members to edit projects</li>
              <li>Real-time collaborative editing</li>
              <li>Comment and review system</li>
              <li>Permission management</li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ShareProjectModal;