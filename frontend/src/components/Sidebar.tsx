import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { setCurrentProject } from '../store/slices/projectSlice';

const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, currentProject } = useAppSelector((state) => state.project);
  const { sidebarOpen } = useAppSelector((state) => state.ui);
  const [activeTab, setActiveTab] = useState<'projects' | 'files'>('projects');

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      dispatch(setCurrentProject(project));
    }
  };

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
          disabled={!currentProject}
        >
          Files
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'projects' && (
          <div className="projects-panel">
            <div className="panel-header">
              <h3>Your Projects</h3>
              <button className="btn btn-small btn-primary">
                New Project
              </button>
            </div>
            <div className="projects-list">
              {projects.length === 0 ? (
                <div className="empty-state">
                  <p>No projects yet</p>
                  <p className="empty-subtitle">Create your first project to get started</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`project-item ${currentProject?.id === project.id ? 'active' : ''}`}
                    onClick={() => handleProjectSelect(project.id)}
                  >
                    <div className="project-name">{project.name}</div>
                    <div className="project-description">{project.description}</div>
                    <div className="project-meta">
                      <span className="file-count">{project.files.length} files</span>
                      <span className="updated-date">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && currentProject && (
          <div className="files-panel">
            <div className="panel-header">
              <h3>Project Files</h3>
              <button className="btn btn-small btn-secondary">
                Add File
              </button>
            </div>
            <div className="files-list">
              {currentProject.files.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="file-icon">
                    {file.type === 'html' && '📄'}
                    {file.type === 'css' && '🎨'}
                    {file.type === 'js' && '⚡'}
                    {file.type === 'json' && '📋'}
                  </div>
                  <div className="file-name">{file.filename}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;