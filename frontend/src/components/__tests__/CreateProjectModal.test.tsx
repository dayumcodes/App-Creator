import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import CreateProjectModal from '../CreateProjectModal';
import { apiService } from '../../services/api';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';

// Mock the API service
vi.mock('../../services/api');
const mockApiService = apiService as any;

// Mock Modal component
vi.mock('../Modal', () => ({
  default: ({ children, onClose, title }: any) => {
    return (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="modal-close">Close</button>
        {children}
      </div>
    );
  }
}));

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

describe('CreateProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with correct title and form fields', () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Create New Project');
    expect(screen.getByLabelText('Project Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  it('validates required project name', async () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    expect(mockApiService.createProject).not.toHaveBeenCalled();
  });

  it('validates minimum project name length', async () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'a' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum project name length', async () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const longName = 'a'.repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be less than 100 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum description length', async () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const descriptionInput = screen.getByLabelText('Description');
    
    fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
    fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(501) } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Description must be less than 500 characters')).toBeInTheDocument();
    });
  });

  it('shows character count for description', () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    expect(screen.getByText('16/500 characters')).toBeInTheDocument();
  });

  it('clears validation errors when user starts typing', async () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    // Trigger validation error
    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    // Start typing to clear error
    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    expect(screen.queryByText('Project name is required')).not.toBeInTheDocument();
  });

  it('successfully creates project with valid data', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test description',
      files: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockApiService.createProject.mockResolvedValue({
      data: mockProject,
    });

    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const descriptionInput = screen.getByLabelText('Description');
    
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test description',
      });
    });

    expect(mockHandlers.onSuccess).toHaveBeenCalled();
  });

  it('creates project without description', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: '',
      files: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockApiService.createProject.mockResolvedValue({
      data: mockProject,
    });

    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: undefined,
      });
    });
  });

  it('handles API error during project creation', async () => {
    mockApiService.createProject.mockResolvedValue({
      error: 'Failed to create project',
    });

    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.createProject).toHaveBeenCalled();
    });

    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    mockApiService.createProject.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: {} as any }), 100))
    );

    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('trims whitespace from input values', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test description',
      files: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockApiService.createProject.mockResolvedValue({
      data: mockProject,
    });

    renderWithStore(<CreateProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const descriptionInput = screen.getByLabelText('Description');
    
    fireEvent.change(nameInput, { target: { value: '  Test Project  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  Test description  ' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test description',
      });
    });
  });
});