import React, { useState, useRef } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { apiService } from '../services/api';
import { addProject, setError } from '../store/slices/projectSlice';
import Modal from './Modal';

interface ImportProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ImportProjectModal: React.FC<ImportProjectModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    if (!selectedFile) {
      newErrors.file = 'ZIP file is required';
    } else if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      newErrors.file = 'Only ZIP files are allowed';
    } else if (selectedFile.size > 10 * 1024 * 1024) {
      newErrors.file = 'File size must be less than 10MB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Auto-fill project name from filename if empty
    if (!formData.name.trim()) {
      const nameFromFile = file.name.replace(/\.zip$/i, '').replace(/[_-]/g, ' ');
      setFormData(prev => ({ ...prev, name: nameFromFile }));
    }
    
    // Clear file error
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const zipFile = files.find(file => file.name.toLowerCase().endsWith('.zip'));
    
    if (zipFile) {
      handleFileSelect(zipFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await apiService.importProject(
        selectedFile!,
        formData.name.trim(),
        formData.description?.trim() || undefined
      );

      if (response.error) {
        dispatch(setError(response.error));
      } else if (response.data) {
        dispatch(addProject(response.data));
        onSuccess();
      }
    } catch (err) {
      dispatch(setError('Failed to import project'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal onClose={onClose} title="Import Project" size="medium">
      <form onSubmit={handleSubmit} className="import-project-form">
        <div className="form-group">
          <label htmlFor="name">Project Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={errors.name ? 'error' : ''}
            placeholder="Enter project name"
            disabled={isSubmitting}
            autoFocus
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className={errors.description ? 'error' : ''}
            placeholder="Describe your project (optional)"
            rows={3}
            disabled={isSubmitting}
          />
          {errors.description && <div className="field-error">{errors.description}</div>}
          <div className="field-hint">
            {formData.description?.length || 0}/500 characters
          </div>
        </div>

        <div className="form-group">
          <label>ZIP File *</label>
          <div
            className={`file-drop-zone ${dragActive ? 'active' : ''} ${errors.file ? 'error' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              disabled={isSubmitting}
            />
            
            {selectedFile ? (
              <div className="selected-file">
                <div className="file-icon">📁</div>
                <div className="file-info">
                  <div className="file-name">{selectedFile.name}</div>
                  <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="remove-file"
                  disabled={isSubmitting}
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="drop-zone-content">
                <div className="drop-icon">📁</div>
                <div className="drop-text">
                  <strong>Click to select</strong> or drag and drop a ZIP file
                </div>
                <div className="drop-hint">
                  Maximum file size: 10MB
                </div>
              </div>
            )}
          </div>
          {errors.file && <div className="field-error">{errors.file}</div>}
        </div>

        <div className="import-info">
          <h4>Supported Files</h4>
          <p>The ZIP file should contain web files with the following extensions:</p>
          <ul>
            <li><strong>.html</strong> - HTML files</li>
            <li><strong>.css</strong> - CSS stylesheets</li>
            <li><strong>.js</strong> - JavaScript files</li>
            <li><strong>.json</strong> - JSON data files</li>
          </ul>
          <p className="import-note">
            Other file types will be ignored during import.
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Importing...' : 'Import Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ImportProjectModal;