import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';
import { api } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('DiffViewer', () => {
  const mockProjectId = 'project-123';
  const mockVersionId1 = 'version-1';
  const mockVersionId2 = 'version-2';

  const mockDiffs = [
    {
      filename: 'index.html',
      oldContent: '<html>\n  <body>Old content</body>\n</html>',
      newContent: '<html>\n  <body>New content</body>\n</html>',
      diff: '  <html>\n-   <body>Old content</body>\n+   <body>New content</body>\n  </html>',
      changeType: 'UPDATE' as const,
    },
    {
      filename: 'style.css',
      oldContent: '',
      newContent: 'body { color: red; }',
      diff: '+ body { color: red; }',
      changeType: 'CREATE' as const,
    },
    {
      filename: 'old-file.js',
      oldContent: 'console.log("old");',
      newContent: '',
      diff: '- console.log("old");',
      changeType: 'DELETE' as const,
    },
  ];

  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: mockDiffs });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render diff viewer for version comparison', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    expect(screen.getByText('Compare Versions')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Changed Files (3)')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.getByText('style.css')).toBeInTheDocument();
      expect(screen.getByText('old-file.js')).toBeInTheDocument();
    });

    expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/compare/${mockVersionId1}/${mockVersionId2}`);
  });

  it('should render diff viewer for current state comparison', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        compareWithCurrent={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Changed Files (3)')).toBeInTheDocument();
    });

    expect(mockApi.get).toHaveBeenCalledWith(`/${mockProjectId}/compare/${mockVersionId1}/current`);
  });

  it('should switch between side-by-side and unified view modes', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    // Initially should be in side-by-side mode
    expect(screen.getByText('Side by Side')).toHaveClass('active');

    // Switch to unified mode
    fireEvent.click(screen.getByText('Unified'));

    expect(screen.getByText('Unified')).toHaveClass('active');
    expect(screen.getByText('Side by Side')).not.toHaveClass('active');
  });

  it('should select first changed file automatically', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      const firstFile = screen.getByText('index.html').closest('.file-item');
      expect(firstFile).toHaveClass('selected');
    });
  });

  it('should allow file selection', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    // Click on style.css
    fireEvent.click(screen.getByText('style.css'));

    const styleCssFile = screen.getByText('style.css').closest('.file-item');
    expect(styleCssFile).toHaveClass('selected');
  });

  it('should display correct change type icons and colors', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    // Check that change type badges are displayed
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
    expect(screen.getByText('CREATE')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
  });

  it('should render unified diff correctly', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    // Switch to unified mode
    fireEvent.click(screen.getByText('Unified'));

    // Select the first file (index.html)
    fireEvent.click(screen.getByText('index.html'));

    // Check that diff content is displayed
    await waitFor(() => {
      expect(screen.getByText('<html>')).toBeInTheDocument();
    });
  });

  it('should render side-by-side diff correctly', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    // Should be in side-by-side mode by default
    fireEvent.click(screen.getByText('index.html'));

    await waitFor(() => {
      expect(screen.getByText('Old Version')).toBeInTheDocument();
      expect(screen.getByText('New Version')).toBeInTheDocument();
    });
  });

  it('should handle file creation display', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('style.css')).toBeInTheDocument();
    });

    // Select the created file
    fireEvent.click(screen.getByText('style.css'));

    await waitFor(() => {
      expect(screen.getByText('File was created')).toBeInTheDocument();
      expect(screen.getByText('body { color: red; }')).toBeInTheDocument();
    });
  });

  it('should handle file deletion display', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('old-file.js')).toBeInTheDocument();
    });

    // Select the deleted file
    fireEvent.click(screen.getByText('old-file.js'));

    await waitFor(() => {
      expect(screen.getByText('File was deleted')).toBeInTheDocument();
      expect(screen.getByText('console.log("old");')).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = jest.fn();
    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('×'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle loading state', () => {
    // Mock a pending promise
    mockApi.get.mockReturnValue(new Promise(() => {}));

    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    expect(screen.getByText('Loading diff...')).toBeInTheDocument();
  });

  it('should handle API errors', async () => {
    mockApi.get.mockRejectedValue(new Error('API Error'));

    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load diff')).toBeInTheDocument();
    });
  });

  it('should show no changes message when no diffs', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No changes found')).toBeInTheDocument();
    });
  });

  it('should show no file selected message initially', async () => {
    // Mock empty diffs so no file is auto-selected
    mockApi.get.mockResolvedValue({ data: [] });

    render(
      <DiffViewer
        projectId={mockProjectId}
        versionId1={mockVersionId1}
        versionId2={mockVersionId2}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select a file to view changes')).toBeInTheDocument();
    });
  });

  it('should handle invalid comparison parameters', async () => {
    render(
      <DiffViewer
        projectId={mockProjectId}
        // No version IDs provided
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load diff')).toBeInTheDocument();
    });
  });
});