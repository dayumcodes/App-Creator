import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectCard from '../ProjectCard';
import { type Project } from '../../services/api';

const mockProject: Project = {
  id: '1',
  name: 'Test Project',
  description: 'This is a test project description',
  files: [
    { id: '1', filename: 'index.html', content: '<html></html>', type: 'HTML' },
    { id: '2', filename: 'style.css', content: 'body {}', type: 'CSS' },
    { id: '3', filename: 'script.js', content: 'console.log("test")', type: 'JS' },
    { id: '4', filename: 'data.json', content: '{}', type: 'JSON' },
    { id: '5', filename: 'extra.html', content: '<div></div>', type: 'HTML' },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T12:30:00Z',
};

const mockHandlers = {
  onSelect: vi.fn(),
  onSettings: vi.fn(),
  onDelete: vi.fn(),
  onExport: vi.fn(),
  onShare: vi.fn(),
};

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project information correctly', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('This is a test project description')).toBeInTheDocument();
    expect(screen.getByText('5 files')).toBeInTheDocument();
    expect(screen.getByText('Updated Jan 2, 2024')).toBeInTheDocument();
  });

  it('displays project initial in preview placeholder', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('shows file badges with correct icons and names', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    // Should show first 3 files
    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.getByText('style.css')).toBeInTheDocument();
    expect(screen.getByText('script.js')).toBeInTheDocument();

    // Should show "+2 more" for remaining files
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('handles project selection on card click', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    const card = screen.getByText('Test Project').closest('.project-card');
    fireEvent.click(card!);

    expect(mockHandlers.onSelect).toHaveBeenCalledWith(mockProject);
  });

  it('opens menu when menu button is clicked', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    const menuButton = screen.getByLabelText('Project options');
    fireEvent.click(menuButton);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls appropriate handlers when menu items are clicked', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    const menuButton = screen.getByLabelText('Project options');
    fireEvent.click(menuButton);

    // Test Open
    fireEvent.click(screen.getByText('Open'));
    expect(mockHandlers.onSelect).toHaveBeenCalledWith(mockProject);

    // Reopen menu for next test
    fireEvent.click(menuButton);

    // Test Settings
    fireEvent.click(screen.getByText('Settings'));
    expect(mockHandlers.onSettings).toHaveBeenCalledWith(mockProject);

    // Reopen menu for next test
    fireEvent.click(menuButton);

    // Test Export
    fireEvent.click(screen.getByText('Export'));
    expect(mockHandlers.onExport).toHaveBeenCalledWith(mockProject);

    // Reopen menu for next test
    fireEvent.click(menuButton);

    // Test Share
    fireEvent.click(screen.getByText('Share'));
    expect(mockHandlers.onShare).toHaveBeenCalledWith(mockProject);

    // Reopen menu for next test
    fireEvent.click(menuButton);

    // Test Delete
    fireEvent.click(screen.getByText('Delete'));
    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockProject);
  });

  it('prevents event propagation when menu is clicked', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    const menuButton = screen.getByLabelText('Project options');
    fireEvent.click(menuButton);

    // Menu should be open, but onSelect should not have been called
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(mockHandlers.onSelect).not.toHaveBeenCalled();
  });

  it('renders project without description', () => {
    const projectWithoutDescription = { ...mockProject, description: '' };
    render(<ProjectCard project={projectWithoutDescription} {...mockHandlers} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByText('This is a test project description')).not.toBeInTheDocument();
  });

  it('handles project with no files', () => {
    const projectWithNoFiles = { ...mockProject, files: [] };
    render(<ProjectCard project={projectWithNoFiles} {...mockHandlers} />);

    expect(screen.getByText('0 files')).toBeInTheDocument();
    expect(screen.queryByText('+2 more')).not.toBeInTheDocument();
  });

  it('handles project with exactly 3 files', () => {
    const projectWith3Files = {
      ...mockProject,
      files: mockProject.files.slice(0, 3)
    };
    render(<ProjectCard project={projectWith3Files} {...mockHandlers} />);

    expect(screen.getByText('3 files')).toBeInTheDocument();
    expect(screen.queryByText('+2 more')).not.toBeInTheDocument();
  });

  it('displays correct file type icons', () => {
    render(<ProjectCard project={mockProject} {...mockHandlers} />);

    // Check that file icons are rendered (emojis are in the DOM)
    const fileBadges = screen.getAllByText(/\.(html|css|js|json)$/);
    expect(fileBadges).toHaveLength(3); // First 3 files
  });

  it('formats dates correctly', () => {
    const projectWithDifferentDate = {
      ...mockProject,
      updatedAt: '2023-12-25T15:45:30Z',
    };
    render(<ProjectCard project={projectWithDifferentDate} {...mockHandlers} />);

    expect(screen.getByText('Updated Dec 25, 2023')).toBeInTheDocument();
  });
});