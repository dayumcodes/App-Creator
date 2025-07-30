import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DeleteProjectModal from '../DeleteProjectModal';
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

describe('DeleteProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with correct title and warning', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Delete Project');
    expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'medium');
    expect(screen.getByText('Are you sure you want to delete this project?')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('displays project details correctly', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.getByText('1/1/2024')).toBeInTheDocument();
  });

  it('handles project without description', () => {
    const projectWithoutDescription = { ...mockProject, description: '' };
    
    renderWithStore(
      <DeleteProjectModal project={projectWithoutDescription} {...mockHandlers} />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('requires confirmation text to match project name', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    const deleteButton = screen.getByText('Delete Project');

    // Initially disabled
    expect(deleteButton).toBeDisabled();

    // Wrong confirmation text
    fireEvent.change(confirmationInput, { target: { value: 'Wrong Name' } });
    expect(deleteButton).toBeDisabled();
    expect(screen.getByText(/Project name doesn't match/)).toBeInTheDocument();

    // Correct confirmation text
    fireEvent.change(confirmationInput, { target: { value: 'Test Project' } });
    expect(deleteButton).not.toBeDisabled();
    expect(screen.queryByText(/Project name doesn't match/)).not.toBeInTheDocument();
  });

  it('shows validation error for incorrect confirmation', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    fireEvent.change(confirmationInput, { target: { value: 'Wrong' } });

    expect(screen.getByText('Project name doesn\'t match. Please type "Test Project" exactly.')).toBeInTheDocument();
    expect(confirmationInput).toHaveClass('error');
  });

  it('successfully deletes project with correct confirmation', async () => {
    mockApiService.deleteProject.mockResolvedValue({
      data: mockProject,
    });

    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    const deleteButton = screen.getByText('Delete Project');

    fireEvent.change(confirmationInput, { target: { value: 'Test Project' } });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockApiService.deleteProject).toHaveBeenCalledWith('1');
    });

    expect(mockHandlers.onSuccess).toHaveBeenCalled();
  });

  it('handles API error during deletion', async () => {
    mockApiService.deleteProject.mockResolvedValue({
      error: 'Failed to delete project',
    });

    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    const deleteButton = screen.getByText('Delete Project');

    fireEvent.change(confirmationInput, { target: { value: 'Test Project' } });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockApiService.deleteProject).toHaveBeenCalled();
    });

    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during deletion', async () => {
    mockApiService.deleteProject.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: mockProject }), 100))
    );

    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    const deleteButton = screen.getByText('Delete Project');

    fireEvent.change(confirmationInput, { target: { value: 'Test Project' } });
    fireEvent.click(deleteButton);

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(confirmationInput).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('disables form during deletion process', async () => {
    mockApiService.deleteProject.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: mockProject }), 100))
    );

    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const confirmationInput = screen.getByPlaceholderText('Type "Test Project" here');
    const deleteButton = screen.getByText('Delete Project');
    const cancelButton = screen.getByText('Cancel');

    fireEvent.change(confirmationInput, { target: { value: 'Test Project' } });
    fireEvent.click(deleteButton);

    expect(confirmationInput).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });
  });

  it('prevents deletion without valid confirmation', () => {
    renderWithStore(
      <DeleteProjectModal project={mockProject} {...mockHandlers} />
    );

    const deleteButton = screen.getByText('Delete Project');
    
    // Try to click without confirmation
    fireEvent.click(deleteButton);

    expect(mockApiService.deleteProject).not.toHaveBeenCalled();
    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('handles project with single file correctly', () => {
    const projectWithOneFile = {
      ...mockProject,
      files: [mockProject.files[0]],
    };
    
    renderWithStore(
      <DeleteProjectModal project={projectWithOneFile} {...mockHandlers} />
    );

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('handles project with no files', () => {
    const projectWithNoFiles = {
      ...mockProject,
      files: [],
    };
    
    renderWithStore(
      <DeleteProjectModal project={projectWithNoFiles} {...mockHandlers} />
    );

    expect(screen.getByText('0 files')).toBeInTheDocument();
  });
});