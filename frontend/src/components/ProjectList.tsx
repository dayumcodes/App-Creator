import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { apiService, type Project } from '../services/api';
import { 
  setLoading, 
  setProjects, 
  setSearchQuery, 
  setPagination, 
  setError, 
  clearError,
  setCurrentProject 
} from '../store/slices/projectSlice';
import LoadingSpinner from './LoadingSpinner';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import ImportProjectModal from './ImportProjectModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import DeleteProjectModal from './DeleteProjectModal';
import ShareProjectModal from './ShareProjectModal';

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, isLoading, error, searchQuery, pagination } = useAppSelector(state => state.project);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const loadProjects = useCallback(async (page = 1, search = searchQuery) => {
    dispatch(setLoading(true));
    dispatch(clearError());
    
    try {
      const response = await apiService.getProjects({
        page,
        limit: pagination.limit,
        search: search || undefined,
      });

      if (response.error) {
        dispatch(setError(response.error));
      } else if (response.data) {
        dispatch(setProjects({
          projects: response.data.data,
          pagination: response.data.pagination,
        }));
      }
    } catch (err) {
      dispatch(setError('Failed to load projects'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, searchQuery, pagination.limit]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSearch = useCallback((query: string) => {
    dispatch(setSearchQuery(query));
    dispatch(setPagination({ page: 1 }));
    loadProjects(1, query);
  }, [dispatch, loadProjects]);

  const handlePageChange = useCallback((page: number) => {
    dispatch(setPagination({ page }));
    loadProjects(page);
  }, [dispatch, loadProjects]);

  const handleProjectSelect = (project: Project) => {
    dispatch(setCurrentProject(project));
  };

  const handleProjectSettings = (project: Project) => {
    setSelectedProject(project);
    setShowSettingsModal(true);
  };

  const handleProjectDelete = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const handleProjectShare = (project: Project) => {
    setSelectedProject(project);
    setShowShareModal(true);
  };

  const handleExportProject = async (project: Project) => {
    try {
      const response = await apiService.exportProject(project.id);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        dispatch(setError('Failed to export project'));
      }
    } catch (err) {
      dispatch(setError('Failed to export project'));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchInput);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (e.target.value === '') {
      handleSearch('');
    }
  };

  if (isLoading && projects.length === 0) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <div className="header-left">
          <h2>My Projects</h2>
          <p className="project-count">
            {pagination.total} project{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="header-right">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchInput}
              onChange={handleSearchInputChange}
              className="search-input"
            />
            <button type="submit" className="btn btn-secondary btn-small">
              Search
            </button>
          </form>
          <div className="project-actions">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-secondary"
            >
              Import Project
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              New Project
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => dispatch(clearError())} className="error-close">
            ×
          </button>
        </div>
      )}

      {projects.length === 0 && !isLoading ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No projects found</h3>
          <p className="empty-subtitle">
            {searchQuery 
              ? `No projects match "${searchQuery}"`
              : "Create your first project to get started"
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="projects-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={handleProjectSelect}
                onSettings={handleProjectSettings}
                onDelete={handleProjectDelete}
                onExport={handleExportProject}
                onShare={handleProjectShare}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-secondary btn-small"
              >
                Previous
              </button>
              
              <div className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-secondary btn-small"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {isLoading && projects.length > 0 && (
        <div className="loading-overlay">
          <LoadingSpinner size="small" />
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProjects();
          }}
        />
      )}

      {showImportModal && (
        <ImportProjectModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            loadProjects();
          }}
        />
      )}

      {showSettingsModal && selectedProject && (
        <ProjectSettingsModal
          project={selectedProject}
          onClose={() => {
            setShowSettingsModal(false);
            setSelectedProject(null);
          }}
          onSuccess={() => {
            setShowSettingsModal(false);
            setSelectedProject(null);
            loadProjects();
          }}
        />
      )}

      {showDeleteModal && selectedProject && (
        <DeleteProjectModal
          project={selectedProject}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProject(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedProject(null);
            loadProjects();
          }}
        />
      )}

      {showShareModal && selectedProject && (
        <ShareProjectModal
          project={selectedProject}
          onClose={() => {
            setShowShareModal(false);
            setSelectedProject(null);
          }}
        />
      )}
    </div>
  );
};

export default ProjectList;