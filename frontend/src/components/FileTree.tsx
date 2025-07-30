import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { setActiveFile, addFile, deleteFile, renameFile } from '../store/slices/projectSlice';

interface FileTreeProps {
  onCreateFile: (filename: string, type: string) => void;
  onDeleteFile: (filename: string) => void;
  onRenameFile: (oldFilename: string, newFilename: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ onCreateFile, onDeleteFile, onRenameFile }) => {
  const dispatch = useAppDispatch();
  const { currentProject, activeFile } = useAppSelector((state) => state.project);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filename?: string } | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFileType, setNewFileType] = useState('js');

  if (!currentProject) {
    return (
      <div className="file-tree-empty">
        <p>No project loaded</p>
      </div>
    );
  }

  const handleFileClick = (filename: string) => {
    dispatch(setActiveFile(filename));
  };

  const handleContextMenu = (e: React.MouseEvent, filename?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, filename });
  };

  const handleCreateFile = () => {
    setShowCreateDialog(true);
    setContextMenu(null);
  };

  const handleDeleteFile = (filename: string) => {
    if (window.confirm(`Are you sure you want to delete ${filename}?`)) {
      onDeleteFile(filename);
      dispatch(deleteFile(filename));
    }
    setContextMenu(null);
  };

  const handleRenameFile = (filename: string) => {
    setRenamingFile(filename);
    setNewFileName(filename);
    setContextMenu(null);
  };

  const confirmRename = () => {
    if (renamingFile && newFileName && newFileName !== renamingFile) {
      onRenameFile(renamingFile, newFileName);
      dispatch(renameFile({ oldFilename: renamingFile, newFilename: newFileName }));
    }
    setRenamingFile(null);
    setNewFileName('');
  };

  const cancelRename = () => {
    setRenamingFile(null);
    setNewFileName('');
  };

  const confirmCreateFile = () => {
    if (newFileName.trim()) {
      const filename = newFileName.includes('.') ? newFileName : `${newFileName}.${newFileType}`;
      const newFile = {
        id: Date.now().toString(),
        filename,
        content: getDefaultContent(filename),
        type: getFileType(filename),
      };
      onCreateFile(filename, getFileType(filename));
      dispatch(addFile(newFile));
    }
    setShowCreateDialog(false);
    setNewFileName('');
  };

  const getDefaultContent = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'html':
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
</body>
</html>`;
      case 'css':
        return `/* Add your styles here */
`;
      case 'js':
        return `// Add your JavaScript code here
`;
      case 'ts':
        return `// Add your TypeScript code here
`;
      case 'json':
        return `{
  
}`;
      default:
        return '';
    }
  };

  const getFileType = (filename: string): 'HTML' | 'CSS' | 'JS' | 'JSON' => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'js':
      case 'ts':
        return 'JS';
      case 'json':
        return 'JSON';
      default:
        return 'JS';
    }
  };

  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'js':
      case 'ts':
        return '📜';
      case 'json':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <h3>Files</h3>
        <button 
          className="btn btn-small btn-icon"
          onClick={handleCreateFile}
          title="Create new file"
        >
          ➕
        </button>
      </div>

      <div className="file-tree-content" onContextMenu={(e) => handleContextMenu(e)}>
        {currentProject.files.map((file) => (
          <div key={file.id} className="file-tree-item">
            {renamingFile === file.filename ? (
              <div className="file-rename-input">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onBlur={confirmRename}
                  autoFocus
                />
              </div>
            ) : (
              <div
                className={`file-item ${activeFile === file.filename ? 'active' : ''}`}
                onClick={() => handleFileClick(file.filename)}
                onContextMenu={(e) => handleContextMenu(e, file.filename)}
              >
                <span className="file-icon">{getFileIcon(file.filename)}</span>
                <span className="file-name">{file.filename}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={handleCreateFile}>New File</button>
          {contextMenu.filename && (
            <>
              <button onClick={() => handleRenameFile(contextMenu.filename!)}>Rename</button>
              <button onClick={() => handleDeleteFile(contextMenu.filename!)}>Delete</button>
            </>
          )}
        </div>
      )}

      {showCreateDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New File</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateDialog(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="filename">File Name:</label>
                <input
                  id="filename"
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Enter filename"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="filetype">File Type:</label>
                <select
                  id="filetype"
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value)}
                >
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="js">JavaScript</option>
                  <option value="ts">TypeScript</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmCreateFile}
                disabled={!newFileName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileTree;