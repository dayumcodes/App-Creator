import React from 'react';
import { useAppSelector } from '../hooks/redux';
import LoadingSpinner from '../components/LoadingSpinner';
import PromptInput from '../components/PromptInput';

const Editor: React.FC = () => {
  const { currentProject, activeFile, isLoading } = useAppSelector((state) => state.project);
  const { isGenerating } = useAppSelector((state) => state.ui);

  if (isLoading) {
    return <LoadingSpinner message="Loading project..." />;
  }

  if (!currentProject) {
    return (
      <div className="editor-empty">
        <div className="empty-state">
          <div className="empty-icon">💻</div>
          <h2>No project selected</h2>
          <p>Select a project from the sidebar or create a new one to start coding</p>
          <button className="btn btn-primary">Create New Project</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor-layout">
        <div className="editor-left">
          <PromptInput />
          
          <div className="code-editor-section">
            <div className="editor-tabs">
              {currentProject.files.map((file) => (
                <button
                  key={file.id}
                  className={`editor-tab ${activeFile === file.filename ? 'active' : ''}`}
                >
                  {file.filename}
                </button>
              ))}
            </div>
            <div className="code-editor">
              <div className="editor-placeholder">
                <p>Code editor will be implemented in a future task</p>
                <p>Current file: {activeFile || 'None selected'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="editor-right">
          <div className="preview-section">
            <div className="preview-header">
              <h3>Live Preview</h3>
              <div className="preview-controls">
                <button className="btn btn-small">Refresh</button>
                <button className="btn btn-small">Open in New Tab</button>
              </div>
            </div>
            <div className="preview-container">
              <div className="preview-placeholder">
                <p>Live preview will be implemented in a future task</p>
                <p>Project: {currentProject.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;