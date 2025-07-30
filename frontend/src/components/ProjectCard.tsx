import React, { useState } from 'react';
import { type Project } from '../services/api';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onSettings: (project: Project) => void;
  onDelete: (project: Project) => void;
  onExport: (project: Project) => void;
  onShare: (project: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  onSettings,
  onDelete,
  onExport,
  onShare,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFileTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'js':
        return '⚡';
      case 'json':
        return '📄';
      default:
        return '📄';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as Element).closest('.project-card-content')) {
      onSelect(project);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleMenuItemClick = (action: () => void) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMenu(false);
      action();
    };
  };

  return (
    <div className="project-card" onClick={handleCardClick}>
      <div className="project-card-header">
        <div className="project-preview">
          <div className="preview-placeholder">
            {project.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="project-menu">
          <button
            onClick={handleMenuClick}
            className="menu-button"
            aria-label="Project options"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="project-menu-dropdown">
              <button
                onClick={handleMenuItemClick(() => onSelect(project))}
                className="menu-item"
              >
                Open
              </button>
              <button
                onClick={handleMenuItemClick(() => onSettings(project))}
                className="menu-item"
              >
                Settings
              </button>
              <button
                onClick={handleMenuItemClick(() => onExport(project))}
                className="menu-item"
              >
                Export
              </button>
              <button
                onClick={handleMenuItemClick(() => onShare(project))}
                className="menu-item"
              >
                Share
              </button>
              <div className="menu-divider" />
              <button
                onClick={handleMenuItemClick(() => onDelete(project))}
                className="menu-item danger"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="project-card-content">
        <h3 className="project-title">{project.name}</h3>
        {project.description && (
          <p className="project-description">{project.description}</p>
        )}
        
        <div className="project-files">
          {project.files.slice(0, 3).map((file) => (
            <div key={file.id} className="file-badge">
              <span className="file-icon">{getFileTypeIcon(file.type)}</span>
              <span className="file-name">{file.filename}</span>
            </div>
          ))}
          {project.files.length > 3 && (
            <div className="file-badge more">
              +{project.files.length - 3} more
            </div>
          )}
        </div>

        <div className="project-stats">
          <span className="stat">
            {project.files.length} file{project.files.length !== 1 ? 's' : ''}
          </span>
          <span className="stat">
            Updated {formatDate(project.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;