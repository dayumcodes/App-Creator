import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ShareProjectModal from '../ShareProjectModal';
import { type Project } from '../../services/api';

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

const mockOnClose = vi.fn();

// Mock clipboard API
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock document.execCommand for fallback
document.execCommand = vi.fn();

describe('ShareProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    });
  });

  it('renders modal with correct title and project information', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Share Project');
    expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'medium');
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('handles project without description', () => {
    const projectWithoutDescription = { ...mockProject, description: '' };
    
    render(<ShareProjectModal project={projectWithoutDescription} onClose={mockOnClose} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('displays correct share URL', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const shareInput = screen.getByDisplayValue('http://localhost:3000/projects/1/view');
    expect(shareInput).toBeInTheDocument();
    expect(shareInput).toHaveAttribute('readonly');
  });

  it('copies URL to clipboard when copy button is clicked', async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/projects/1/view');
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();
    
    // Should revert back to "Copy" after 2 seconds
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it('uses fallback copy method when clipboard API fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard API not available'));
    
    // Mock document methods for fallback
    const mockTextArea = {
      value: '',
      select: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockTextArea as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockTextArea as any);
    (document.execCommand as any).mockReturnValue(true);

    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(document.createElement).toHaveBeenCalledWith('textarea');
      expect(mockTextArea.value).toBe('http://localhost:3000/projects/1/view');
      expect(mockTextArea.select).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('shows collaboration coming soon section', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    expect(screen.getByText('Collaboration (Coming Soon)')).toBeInTheDocument();
    expect(screen.getByText('Real-time collaboration features are coming soon:')).toBeInTheDocument();
    expect(screen.getByText('Invite team members to edit projects')).toBeInTheDocument();
    expect(screen.getByText('Real-time collaborative editing')).toBeInTheDocument();
    expect(screen.getByText('Comment and review system')).toBeInTheDocument();
    expect(screen.getByText('Permission management')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles project with single file correctly', () => {
    const projectWithOneFile = {
      ...mockProject,
      files: [mockProject.files[0]],
    };
    
    render(<ShareProjectModal project={projectWithOneFile} onClose={mockOnClose} />);

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('handles project with no files', () => {
    const projectWithNoFiles = {
      ...mockProject,
      files: [],
    };
    
    render(<ShareProjectModal project={projectWithNoFiles} onClose={mockOnClose} />);

    expect(screen.getByText('0 files')).toBeInTheDocument();
  });

  it('focuses share URL input when clicked', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const shareInput = screen.getByDisplayValue('http://localhost:3000/projects/1/view');
    fireEvent.click(shareInput);

    expect(shareInput).toHaveFocus();
  });

  it('shows copy button with success state styling', async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    const copyButton = screen.getByText('Copy');
    expect(copyButton).toHaveClass('btn-primary');

    fireEvent.click(copyButton);

    await waitFor(() => {
      const copiedButton = screen.getByText('Copied!');
      expect(copiedButton).toHaveClass('btn-success');
    });
  });

  it('displays share description correctly', () => {
    render(<ShareProjectModal project={mockProject} onClose={mockOnClose} />);

    expect(screen.getByText('Anyone with this link will be able to view your project (read-only).')).toBeInTheDocument();
  });
});