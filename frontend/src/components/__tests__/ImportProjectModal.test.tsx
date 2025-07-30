import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ImportProjectModal from '../ImportProjectModal';
import { apiService } from '../../services/api';
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

const createMockFile = (name: string, size: number = 1024, type: string = 'application/zip') => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('ImportProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with correct title and form fields', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Import Project');
    expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'medium');
    expect(screen.getByLabelText('Project Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('ZIP File *')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Import Project')).toBeInTheDocument();
  });

  it('validates required project name', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    expect(mockApiService.importProject).not.toHaveBeenCalled();
  });

  it('validates minimum project name length', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'a' } });

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum project name length', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const longName = 'a'.repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Project name must be less than 100 characters')).toBeInTheDocument();
    });
  });

  it('validates maximum description length', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const descriptionInput = screen.getByLabelText('Description');
    
    fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
    fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(501) } });

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Description must be less than 500 characters')).toBeInTheDocument();
    });
  });

  it('validates required ZIP file', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('ZIP file is required')).toBeInTheDocument();
    });
  });

  it('validates file type is ZIP', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    // Mock file input
    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = createMockFile('test.txt', 1024, 'text/plain');
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Only ZIP files are allowed')).toBeInTheDocument();
    });
  });

  it('validates file size limit', async () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    // Mock file input with large file
    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = createMockFile('test.zip', 11 * 1024 * 1024); // 11MB
    
    Object.defineProperty(fileInput, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 10MB')).toBeInTheDocument();
    });
  });

  it('shows character count for description', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    expect(screen.getByText('16/500 characters')).toBeInTheDocument();
  });

  it('auto-fills project name from filename', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('my-awesome-project.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const nameInput = screen.getByLabelText('Project Name *') as HTMLInputElement;
    expect(nameInput.value).toBe('my awesome project');
  });

  it('does not overwrite existing project name when selecting file', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Existing Name' } });

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('my-awesome-project.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    expect((nameInput as HTMLInputElement).value).toBe('Existing Name');
  });

  it('displays selected file information', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('test-project.zip', 2048);
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    expect(screen.getByText('test-project.zip')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('allows removing selected file', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('test-project.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    expect(screen.getByText('test-project.zip')).toBeInTheDocument();

    const removeButton = screen.getByText('×');
    fireEvent.click(removeButton);

    expect(screen.queryByText('test-project.zip')).not.toBeInTheDocument();
    expect(screen.getByText('Click to select')).toBeInTheDocument();
  });

  it('successfully imports project with valid data', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test description',
      files: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockApiService.importProject.mockResolvedValue({
      data: mockProject,
    });

    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    const descriptionInput = screen.getByLabelText('Description');
    
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('test.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.importProject).toHaveBeenCalledWith(
        zipFile,
        'Test Project',
        'Test description'
      );
    });

    expect(mockHandlers.onSuccess).toHaveBeenCalled();
  });

  it('handles API error during import', async () => {
    mockApiService.importProject.mockResolvedValue({
      error: 'Failed to import project',
    });

    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('test.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.importProject).toHaveBeenCalled();
    });

    expect(mockHandlers.onSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    mockApiService.importProject.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: {} as any }), 100))
    );

    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const nameInput = screen.getByLabelText('Project Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Project' } });

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const zipFile = createMockFile('test.zip');
    
    Object.defineProperty(fileInput, 'files', {
      value: [zipFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);

    const submitButton = screen.getByText('Import Project');
    fireEvent.click(submitButton);

    expect(screen.getByText('Importing...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Import Project')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('displays supported file types information', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    expect(screen.getByText('Supported Files')).toBeInTheDocument();
    expect(screen.getByText('.html - HTML files')).toBeInTheDocument();
    expect(screen.getByText('.css - CSS stylesheets')).toBeInTheDocument();
    expect(screen.getByText('.js - JavaScript files')).toBeInTheDocument();
    expect(screen.getByText('.json - JSON data files')).toBeInTheDocument();
    expect(screen.getByText('Other file types will be ignored during import.')).toBeInTheDocument();
  });

  it('formats file sizes correctly', () => {
    renderWithStore(<ImportProjectModal {...mockHandlers} />);

    const fileInput = screen.getByLabelText('ZIP File *').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Test different file sizes
    const testCases = [
      { size: 0, expected: '0 Bytes' },
      { size: 512, expected: '512 Bytes' },
      { size: 1024, expected: '1 KB' },
      { size: 1536, expected: '1.5 KB' },
      { size: 1024 * 1024, expected: '1 MB' },
      { size: 2.5 * 1024 * 1024, expected: '2.5 MB' },
    ];

    testCases.forEach(({ size, expected }) => {
      const zipFile = createMockFile('test.zip', size);
      
      Object.defineProperty(fileInput, 'files', {
        value: [zipFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });
});