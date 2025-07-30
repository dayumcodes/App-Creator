import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { apiService, type Project, type UpdateProjectRequest } from '../services/api';
import { updateProject, setError } from '../store/slices/projectSlice';
import Modal from './Modal';

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  project,
  onClose,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState<UpdateProjectRequest>({
    name: project.name,
    description: project.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Check if anything actually changed
    const hasChanges = 
      formData.name?.trim() !== project.name ||
      (formData.description?.trim() || '') !== (project.description || '');

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await apiService.updateProject(project.id, {
        name: formData.name?.trim(),
        description: formData.description?.trim() || undefined,
      });

      if (response.error) {
        dispatch(setError(response.error));
      } else if (response.data) {
        dispatch(updateProject(response.data));
        onSuccess();
      }
    } catch (err) {
      dispatch(setError('Failed to update project'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal onClose={onClose} title="Project Settings" size="medium">
      <div className="project-settings">
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Project Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name || ''}
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
                value={formData.description || ''}
                onChange={handleInputChange}
                className={errors.description ? 'error' : ''}
                placeholder="Describe your project (optional)"
                rows={3}
                disabled={isSubmitting}
              />
              {errors.description && <div className="field-error">{errors.description}</div>}
              <div className="field-hint">
                {(formData.description?.length || 0)}/500 characters
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Project Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Project ID</label>
                <div className="info-value">{project.id}</div>
              </div>
              <div className="info-item">
                <label>Files</label>
                <div className="info-value">
                  {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="info-item">
                <label>Created</label>
                <div className="info-value">{formatDate(project.createdAt)}</div>
              </div>
              <div className="info-item">
                <label>Last Updated</label>
                <div className="info-value">{formatDate(project.updatedAt)}</div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Files</h3>
            <div className="files-list">
              {project.files.length === 0 ? (
                <div className="empty-files">No files in this project</div>
              ) : (
                project.files.map((file) => (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{file.filename}</span>
                      <span className="file-type">{file.type}</span>
                    </div>
                    <div className="file-size">
                      {file.content.length} chars
                    </div>
                  </div>
                ))
              )}
            </div>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProjectSettingsModal;