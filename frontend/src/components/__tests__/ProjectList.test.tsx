import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProjectList from '../ProjectList';
import { apiService } from '../../services/api';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';
import { vi } from 'vitest';

// Mock the API service
vi.mock('../../services/api');
const mockApiService = apiService as any;

// Mock child components
vi.mock('../ProjectCard', () => ({
  default: ({ project, onSelect, onSettings, onDelete, onExport, onShare }: any) => {
    return (
      <div data-testid={`project-card-${project.id}`}>
        <h3>{project.name}</h3>
        <button onClick={() => onSelect(project)}>Select</button>
        <button onClick={() => onSettings(project)}>Settings</button>
        <button onClick={() => onDelete(project)}>Delete</button>
        <button onClick={() => onExport(project)}>Export</button>
        <button onClick={() => onShare(project)}>Share</button>
      </div>
    );
  }
}));

vi.mock('../CreateProjectModal', () => ({
  default: ({ onClose, onSuccess }: any) => {
    return (
      <div data-testid="create-project-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Success</button>
      </div>
    );
  }
}));

vi.mock('../ProjectSettingsModal', () => ({
  default: ({ project, onClose, onSuccess }: any) => {
    return (
      <div data-testid="project-settings-modal">
        <span>{project.name}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Success</button>
      </div>
    );
  }
}));

vi.mock('../DeleteProjectModal', () => ({
  default: ({ project, onClose, onSuccess }: any) => {
    return (
      <div data-testid="delete-project-modal">
        <span>{project.name}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Success</button>
      </div>
    );
  }
}));

vi.mock('../ShareProjectModal', () => ({
  default: ({ project, onClose }: any) => {
    return (
      <div data-testid="share-project-modal">
        <span>{project.name}</span>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }
}));

const mockProjects = [
  {
    id: '1',
    name: 'Test Project 1',
    description: 'Test description 1',
    files: [
      { id: '1', filename: 'index.html', content: '<html></html>', type: 'HTML' as const },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Test Project 2',
    description: 'Test description 2',
    files: [
      { id: '2', filename: 'style.css', content: 'body {}', type: 'CSS' as const },
    ],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      project: projectReducer,
      ui: uiReducer,
    },
    preloadedState: {
      project: {
        projects: [],
        currentProject: null,
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
      ...initialState,
    },
  });
};

const renderWithStore = (component: React.ReactElement, initialState = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('ProjectList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: mockProjects,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    renderWithStore(<ProjectList />, {
      project: { isLoading: true, projects: [] },
    });

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('renders project list when loaded', async () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: mockProjects,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    renderWithStore(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('My Projects')).toBeInTheDocument();
    });
  });

  it('renders empty state when no projects', async () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    });

    renderWithStore(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeInTheDocument();
      expect(screen.getByText('Create your first project to get started')).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: mockProjects,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    renderWithStore(<ProjectList />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockApiService.getProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'test query',
      });
    });
  });

  it('opens create project modal', async () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    });

    renderWithStore(<ProjectList />);

    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);

    await waitFor(() => {
      expect(screen.getByTestId('create-project-modal')).toBeInTheDocument();
    });
  });

  it('handles project export', async () => {
    const mockBlob = new Blob(['test content'], { type: 'application/zip' });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as any;

    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: mockProjects,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    mockApiService.exportProject.mockResolvedValue(mockResponse);

    // Mock URL.createObjectURL and related methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock document methods
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);

    renderWithStore(<ProjectList />, {
      project: {
        projects: mockProjects,
        isLoading: false,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockApiService.exportProject).toHaveBeenCalledWith('1');
    });
  });

  it('displays error message when API fails', async () => {
    mockApiService.getProjects.mockResolvedValue({
      error: 'Failed to load projects',
    });

    renderWithStore(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
    });
  });

  it('handles pagination', async () => {
    mockApiService.getProjects.mockResolvedValue({
      data: {
        data: mockProjects,
        pagination: { page: 1, limit: 10, total: 20, totalPages: 2 },
      },
    });

    renderWithStore(<ProjectList />, {
      project: {
        projects: mockProjects,
        isLoading: false,
        pagination: { page: 1, limit: 10, total: 20, totalPages: 2 },
      },
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiService.getProjects).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: undefined,
      });
    });
  });
});