import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { apiService, type Project } from '../services/api';
import { removeProject, setError } from '../store/slices/projectSlice';
import Modal from './Modal';

interface DeleteProjectModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  project,
  onClose,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmationValid = confirmationText === project.name;

  const handleDelete = async () => {
    if (!isConfirmationValid) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await apiService.deleteProject(project.id);

      if (response.error) {
        dispatch(setError(response.error));
      } else {
        dispatch(removeProject(project.id));
        onSuccess();
      }
    } catch (err) {
      dispatch(setError('Failed to delete project'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmationText(e.target.value);
  };

  return (
    <Modal onClose={onClose} title="Delete Project" size="medium">
      <div className="delete-project-modal">
        <div className="warning-section">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>Are you sure you want to delete this project?</h3>
            <p>
              This action cannot be undone. This will permanently delete the project
              <strong> "{project.name}" </strong>
              and all of its files.
            </p>
          </div>
        </div>

        <div className="project-info-section">
          <h4>Project Details</h4>
          <div className="project-details">
            <div className="detail-item">
              <span className="label">Name:</span>
              <span className="value">{project.name}</span>
            </div>
            {project.description && (
              <div className="detail-item">
                <span className="label">Description:</span>
                <span className="value">{project.description}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="label">Files:</span>
              <span className="value">
                {project.files.length} file{project.files.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Created:</span>
              <span className="value">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="confirmation-section">
          <label htmlFor="confirmation">
            Please type <strong>{project.name}</strong> to confirm:
          </label>
          <input
            type="text"
            id="confirmation"
            value={confirmationText}
            onChange={handleConfirmationChange}
            placeholder={`Type "${project.name}" here`}
            className={confirmationText && !isConfirmationValid ? 'error' : ''}
            disabled={isDeleting}
            autoFocus
          />
          {confirmationText && !isConfirmationValid && (
            <div className="field-error">
              Project name doesn't match. Please type "{project.name}" exactly.
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
            disabled={!isConfirmationValid || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteProjectModal;