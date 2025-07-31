import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistory } from '../VersionHistory';
import { api } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('VersionHistory', () => {
  const mockProjectId = 'project-123';
  const mockVersions = [
    {
      id: 'version-1',
      name: 'v1.0.0',
      description: 'Initial version',
      isActive: false,
      createdAt: '2024-01-25T10:00:00Z',
    },
    {
      id: 'version-2',
      name: 'v1.1.0',
      description: 'Bug fixes',
      isActive: true,
      createdAt: '2024-01-25T11:00:00Z',
    },
  ];

  const mockChanges = [
    {
      id: 'change-1',
      filename: 'index.html',
      changeType: 'UPDATE' as const,
      createdAt: '2024-01-25T10:30:00Z',
    },
    {
      id: 'change-2',
      filename: 'style.css',
      changeType: 'CREATE' as const,
      createdAt: '2024-01-25T10:45:00Z',
    },
  ];

  const mockUndoState = {
    canUndo: true,
    canRedo: false,
    currentPosition: 2,
    totalChanges: 2,
  };

  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/versions')) {
        return Promise.resolve({ data: mockVersions });
      }
      if (url.includes('/changes')) {
        return Promise.resolve({ data: mockChanges });
      }
      if (url.includes('/undo-state')) {
        return Promise.resolve({ data: mockUndoState });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    mockApi.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render version history', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    expect(screen.getByText('Version Control')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      expect(screen.getByText('v1.1.0')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  it('should switch between versions and changes tabs', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    // Switch to changes tab
    fireEvent.click(screen.getByText(/Changes/));

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.getByText('style.css')).toBeInTheDocument();
    });
  });

  it('should show create version modal', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    fireEvent.click(screen.getByText('📸 Save Version'));

    expect(screen.getByText('Create New Version')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Version name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
  });

  it('should create a new version', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    fireEvent.click(screen.getByText('📸 Save Version'));

    const nameInput = screen.getByPlaceholderText('Version name');
    const descriptionInput = screen.getByPlaceholderText('Description (optional)');

    fireEvent.change(nameInput, { target: { value: 'v2.0.0' } });
    fireEvent.change(descriptionInput, { target: { value: 'Major update' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/versions`, {
        name: 'v2.0.0',
        description: 'Major update',
      });
    });
  });

  it('should show error when creating version without name', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    fireEvent.click(screen.getByText('📸 Save Version'));
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Version name is required')).toBeInTheDocument();
    });
  });

  it('should handle rollback confirmation', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    const rollbackButton = screen.getByText('Rollback');
    fireEvent.click(rollbackButton);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/versions/version-1/rollback`);
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should handle undo action', async () => {
    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('↶ Undo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('↶ Undo'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/undo`);
    });
  });

  it('should disable undo button when canUndo is false', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/undo-state')) {
        return Promise.resolve({ 
          data: { ...mockUndoState, canUndo: false, totalChanges: 0 } 
        });
      }
      if (url.includes('/versions')) {
        return Promise.resolve({ data: mockVersions });
      }
      if (url.includes('/changes')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      const undoButton = screen.getByText('↶ Undo');
      expect(undoButton).toBeDisabled();
    });
  });

  it('should create experimental branch', async () => {
    // Mock window.prompt
    const originalPrompt = window.prompt;
    window.prompt = jest.fn(() => 'feature-branch');

    render(<VersionHistory projectId={mockProjectId} />);

    fireEvent.click(screen.getByText('🌿 Create Branch'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/${mockProjectId}/branch`, {
        baseName: 'feature-branch',
        description: 'Experimental branch',
      });
    });

    // Restore original prompt
    window.prompt = originalPrompt;
  });

  it('should handle API errors gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('API Error'));

    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load version history')).toBeInTheDocument();
    });
  });

  it('should show empty states', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/versions')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/changes')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/undo-state')) {
        return Promise.resolve({ data: { ...mockUndoState, canUndo: false, totalChanges: 0 } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<VersionHistory projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('No versions yet. Create your first version to save the current state.')).toBeInTheDocument();
    });

    // Switch to changes tab
    fireEvent.click(screen.getByText(/Changes/));

    await waitFor(() => {
      expect(screen.getByText('No changes yet. Start editing files to see change history.')).toBeInTheDocument();
    });
  });

  it('should call onVersionSelect when version is clicked', async () => {
    const mockOnVersionSelect = jest.fn();
    render(<VersionHistory projectId={mockProjectId} onVersionSelect={mockOnVersionSelect} />);

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('v1.0.0'));

    expect(mockOnVersionSelect).toHaveBeenCalledWith(mockVersions[0]);
  });

  it('should call onRollback when rollback is successful', async () => {
    const mockOnRollback = jest.fn();
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<VersionHistory projectId={mockProjectId} onRollback={mockOnRollback} />);

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Rollback'));

    await waitFor(() => {
      expect(mockOnRollback).toHaveBeenCalled();
    });

    window.confirm = originalConfirm;
  });
});