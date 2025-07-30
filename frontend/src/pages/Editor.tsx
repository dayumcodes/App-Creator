import React from 'react';
import { useAppSelector } from '../hooks/redux';
import LoadingSpinner from '../components/LoadingSpinner';
import PromptInput from '../components/PromptInput';
import MonacoEditor from '../components/MonacoEditor';
import FileTree from '../components/FileTree';
import LivePreview from '../components/LivePreview';
import '../components/Editor.css';

const Editor: React.FC = () => {
  const { currentProject, activeFile, isLoading } = useAppSelector((state) => state.project);
  const { isGenerating } = useAppSelector((state) => state.ui);

  const handleCreateFile = (filename: string, type: string) => {
    // This would typically make an API call to create the file
    console.log('Creating file:', filename, type);
  };

  const handleDeleteFile = (filename: string) => {
    // This would typically make an API call to delete the file
    console.log('Deleting file:', filename);
  };

  const handleRenameFile = (oldFilename: string, newFilename: string) => {
    // This would typically make an API call to rename the file
    console.log('Renaming file:', oldFilename, 'to', newFilename);
  };

  const getCurrentFile = () => {
    if (!currentProject || !activeFile) return null;
    return currentProject.files.find(file => file.filename === activeFile);
  };

  const currentFile = getCurrentFile();

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
          <div className="editor-file-tree">
            <FileTree
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
            />
          </div>
        </div>

        <div className="editor-center">
          <div className="editor-toolbar">
            <div className="editor-toolbar-left">
              <span className="current-file-name">
                {currentFile ? currentFile.filename : 'No file selected'}
              </span>
            </div>
            <div className="editor-toolbar-right">
              <button className="btn btn-small" title="Format Document">
                Format
              </button>
              <button className="btn btn-small" title="Save File">
                Save
              </button>
            </div>
          </div>
          
          <div className="code-editor-container">
            {currentFile ? (
              <MonacoEditor
                filename={currentFile.filename}
                content={currentFile.content}
                language={currentFile.type.toLowerCase()}
              />
            ) : (
              <div className="editor-placeholder">
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <h3>No file selected</h3>
                  <p>Select a file from the file tree or create a new one to start editing</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="editor-right">
          <LivePreview />
        </div>
      </div>
    </div>
  );
};

export default Editor;