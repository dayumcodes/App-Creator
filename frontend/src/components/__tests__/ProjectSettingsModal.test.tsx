import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProjectSettingsModal from '../ProjectSettingsModal';
import { apiService, type Project } from '../../services/api';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';
import { vi } from 'vitest';

// Mock the API service
vi.mock('../../services/api');
const mockApiService = apiService as any;

// Mock Modal component
vi.mock('../Modal', () => ({
  default: ({ children, onClose, title, size }: any) => {
    return (
      <div data-testid="modal" data-size={size}>
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="modal-close">Close</button>
        {children}
      </div>
    );
  }
}));

const mockProject: Project = {
  id: '1',
  name: 'Test Project',
  description: 'Test description',
  files: [
    { id: '1', filename: 'index.html', content: '<html></html>', type: 'HTML' },
    { id: '2', filename: 'style.css', content: 'body {}', type: 'CSS' },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T12:30:00Z',
};

const createTestStore = () => {
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
    },
  });
};

const renderWithStore = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

const mockHandlers = {
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('ProjectSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with correct title and project information', () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Project Settings');
    expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'medium');
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
  });

  it('displays project metadata correctly', () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByText('1')).toBeInTheDocument(); // Project ID
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument(); // Created date
    expect(screen.getByText(/January 2, 2024/)).toBeInTheDocument(); // Updated date
  });

  it('displays project files list', () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.getByText('style.css')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
  });

  it('shows empty state when project has no files', () => {
    const projectWithoutFiles = { ...mockProject, files: [] };
    
    renderWithStore(
      <ProjectSettingsModal project={projectWithoutFiles} {...mockHandlers} />
    );

    expect(screen.getByText('No files in this project')).toBeInTheDocument();
    expect(screen.getByText('0 files')).toBeInTheDocument();
  });

  it('validates required project name', async () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    fireEvent.change(nameInput, { target: { value: '' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    expect(mockApiService.updateProject).not.toHaveBeenCalled();
  });

  it('validates minimum project name length', async () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    fireEvent.change(nameInput, { target: { value: 'a' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum project name length', async () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    const longName = 'a'.repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be less than 100 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum description length', async () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const descriptionInput = screen.getByDisplayValue('Test description');
    fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(501) } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Description must be less than 500 characters')).toBeInTheDocument();
    });
  });

  it('shows character count for description', () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByText('16/500 characters')).toBeInTheDocument();

    const descriptionInput = screen.getByDisplayValue('Test description');
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });

    expect(screen.getByText('15/500 characters')).toBeInTheDocument();
  });

  it('closes modal without saving when no changes are made', async () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockHandlers.onClose).toHaveBeenCalled();
    });

    expect(mockApiService.updateProject).not.toHaveBeenCalled();
    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('successfully updates project with valid changes', async () => {
    const updatedProject = {
      ...mockProject,
      name: 'Updated Project',
      description: 'Updated description',
    };

    mockApiService.updateProject.mockResolvedValue({
      data: updatedProject,
    });

    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    const descriptionInput = screen.getByDisplayValue('Test description');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Project' } });
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.updateProject).toHaveBeenCalledWith('1', {
        name: 'Updated Project',
        description: 'Updated description',
      });
    });

    expect(mockHandlers.onSuccess).toHaveBeenCalled();
  });

  it('handles API error during update', async () => {
    mockApiService.updateProject.mockResolvedValue({
      error: 'Failed to update project',
    });

    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    fireEvent.change(nameInput, { target: { value: 'Updated Project' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.updateProject).toHaveBeenCalled();
    });

    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    mockApiService.updateProject.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: mockProject }), 100))
    );

    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    fireEvent.change(nameInput, { target: { value: 'Updated Project' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('trims whitespace from input values', async () => {
    const updatedProject = {
      ...mockProject,
      name: 'Updated Project',
      description: 'Updated description',
    };

    mockApiService.updateProject.mockResolvedValue({
      data: updatedProject,
    });

    renderWithStore(
      <ProjectSettingsModal project={mockProject} {...mockHandlers} />
    );

    const nameInput = screen.getByDisplayValue('Test Project');
    const descriptionInput = screen.getByDisplayValue('Test description');
    
    fireEvent.change(nameInput, { target: { value: '  Updated Project  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  Updated description  ' } });

    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.updateProject).toHaveBeenCalledWith('1', {
        name: 'Updated Project',
        description: 'Updated description',
      });
    });
  });

  it('handles project without description', () => {
    const projectWithoutDescription = { ...mockProject, description: '' };
    
    renderWithStore(
      <ProjectSettingsModal project={projectWithoutDescription} {...mockHandlers} />
    );

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();
  });
});