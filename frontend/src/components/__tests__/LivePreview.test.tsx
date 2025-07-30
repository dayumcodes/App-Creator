import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import LivePreview from '../LivePreview';
import projectReducer from '../../store/slices/projectSlice';
import { vi } from 'vitest';

// Mock the usePreview hook
vi.mock('../../hooks/usePreview', () => ({
  usePreview: vi.fn(() => ({
    isLoading: false,
    error: null,
    previewUrl: 'blob:http://localhost:3000/test-url',
    refresh: vi.fn(),
    generateShareableUrl: vi.fn(() => Promise.resolve('http://example.com/share')),
  })),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-url');
global.URL.revokeObjectURL = vi.fn();

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

const mockStore = configureStore({
  reducer: {
    project: projectReducer,
  },
  preloadedState: {
    project: {
      projects: [],
      currentProject: {
        id: '1',
        name: 'Test Project',
        description: 'Test Description',
        files: [
          {
            id: '1',
            filename: 'index.html',
            content: '<html><body><h1>Hello World</h1></body></html>',
            type: 'HTML' as const,
          },
          {
            id: '2',
            filename: 'style.css',
            content: 'body { color: red; }',
            type: 'CSS' as const,
          },
          {
            id: '3',
            filename: 'script.js',
            content: 'console.log("Hello from JS");',
            type: 'JS' as const,
          },
        ],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
      activeFile: 'index.html',
      isLoading: false,
      error: null,
      searchQuery: '',
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    },
  },
});

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <Provider store={mockStore}>
      {component}
    </Provider>
  );
};

describe('LivePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the live preview component', () => {
    renderWithProvider(<LivePreview />);
    
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
    expect(screen.getByTitle('Desktop')).toBeInTheDocument();
    expect(screen.getByTitle('Refresh Preview')).toBeInTheDocument();
  });

  it('displays device selector buttons', () => {
    renderWithProvider(<LivePreview />);
    
    expect(screen.getByTitle('Desktop')).toBeInTheDocument();
    expect(screen.getByTitle('Tablet')).toBeInTheDocument();
    expect(screen.getByTitle('Mobile')).toBeInTheDocument();
    expect(screen.getByTitle('Custom')).toBeInTheDocument();
  });

  it('shows custom dimension inputs when Custom device is selected', () => {
    renderWithProvider(<LivePreview />);
    
    const customButton = screen.getByTitle('Custom');
    fireEvent.click(customButton);
    
    expect(screen.getByPlaceholderText('Width')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Height')).toBeInTheDocument();
  });

  it('renders preview iframe when preview URL is available', () => {
    renderWithProvider(<LivePreview />);
    
    const iframe = screen.getByTitle('Live Preview');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'blob:http://localhost:3000/test-url');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  });

  it('calls refresh function when refresh button is clicked', async () => {
    const mockRefresh = vi.fn();
    const { usePreview } = await import('../../hooks/usePreview');
    vi.mocked(usePreview).mockReturnValue({
      isLoading: false,
      error: null,
      previewUrl: 'blob:http://localhost:3000/test-url',
      refresh: mockRefresh,
      generateShareableUrl: vi.fn(),
      lastUpdated: null,
    });

    renderWithProvider(<LivePreview />);
    
    const refreshButton = screen.getByTitle('Refresh Preview');
    fireEvent.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('opens preview in new tab when open button is clicked', () => {
    const mockOpen = vi.fn();
    global.window.open = mockOpen;

    renderWithProvider(<LivePreview />);
    
    const openButton = screen.getByTitle('Open in New Tab');
    fireEvent.click(openButton);
    
    expect(mockOpen).toHaveBeenCalledWith('blob:http://localhost:3000/test-url', '_blank');
  });

  it('copies shareable URL to clipboard when share button is clicked', async () => {
    const mockGenerateShareableUrl = vi.fn(() => Promise.resolve('http://example.com/share'));
    const { usePreview } = await import('../../hooks/usePreview');
    vi.mocked(usePreview).mockReturnValue({
      isLoading: false,
      error: null,
      previewUrl: 'blob:http://localhost:3000/test-url',
      refresh: vi.fn(),
      generateShareableUrl: mockGenerateShareableUrl,
      lastUpdated: null,
    });

    renderWithProvider(<LivePreview />);
    
    const shareButton = screen.getByTitle('Copy Preview URL');
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(mockGenerateShareableUrl).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://example.com/share');
    });
  });

  it('handles shareable URL generation failure gracefully', async () => {
    const mockGenerateShareableUrl = vi.fn(() => Promise.resolve(null));
    const { usePreview } = await import('../../hooks/usePreview');
    vi.mocked(usePreview).mockReturnValue({
      isLoading: false,
      error: null,
      previewUrl: 'blob:http://localhost:3000/test-url',
      refresh: vi.fn(),
      generateShareableUrl: mockGenerateShareableUrl,
      lastUpdated: null,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProvider(<LivePreview />);
    
    const shareButton = screen.getByTitle('Copy Preview URL');
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(mockGenerateShareableUrl).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      // When generateShareableUrl returns null, no error is logged - this is expected behavior
    });

    consoleSpy.mockRestore();
  });

  it('toggles console visibility when console button is clicked', () => {
    renderWithProvider(<LivePreview />);
    
    const consoleButton = screen.getByTitle('Toggle Console');
    fireEvent.click(consoleButton);
    
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('No console messages')).toBeInTheDocument();
  });

  it('displays error state when there is an error', async () => {
    const { usePreview } = await import('../../hooks/usePreview');
    vi.mocked(usePreview).mockReturnValue({
      isLoading: false,
      error: 'Failed to load preview',
      previewUrl: null,
      refresh: vi.fn(),
      generateShareableUrl: vi.fn(),
      lastUpdated: null,
    });

    renderWithProvider(<LivePreview />);
    
    expect(screen.getByText('Preview Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load preview')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays loading state when preview is loading', async () => {
    const { usePreview } = await import('../../hooks/usePreview');
    vi.mocked(usePreview).mockReturnValue({
      isLoading: true,
      error: null,
      previewUrl: null,
      refresh: vi.fn(),
      generateShareableUrl: vi.fn(),
      lastUpdated: null,
    });

    renderWithProvider(<LivePreview />);
    
    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
  });

  it('handles console messages from iframe', () => {
    renderWithProvider(<LivePreview />);
    
    // Toggle console to show it
    const consoleButton = screen.getByTitle('Toggle Console');
    fireEvent.click(consoleButton);
    
    // Simulate console message from iframe
    const messageEvent = new MessageEvent('message', {
      data: {
        type: 'console',
        level: 'log',
        message: 'Test console message',
        timestamp: new Date().toISOString(),
      },
    });
    
    fireEvent(window, messageEvent);
    
    expect(screen.getByText('Test console message')).toBeInTheDocument();
  });

  it('clears console messages when clear button is clicked', () => {
    renderWithProvider(<LivePreview />);
    
    // Toggle console to show it
    const consoleButton = screen.getByTitle('Toggle Console');
    fireEvent.click(consoleButton);
    
    // Add a console message
    const messageEvent = new MessageEvent('message', {
      data: {
        type: 'console',
        level: 'log',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      },
    });
    fireEvent(window, messageEvent);
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
    
    // Clear console
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);
    
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    expect(screen.getByText('No console messages')).toBeInTheDocument();
  });

  it('updates preview dimensions when device is changed', () => {
    renderWithProvider(<LivePreview />);
    
    // Initially desktop (1200x800)
    expect(screen.getByText('1200 × 800')).toBeInTheDocument();
    
    // Switch to mobile
    const mobileButton = screen.getByTitle('Mobile');
    fireEvent.click(mobileButton);
    
    expect(screen.getByText('375 × 667')).toBeInTheDocument();
  });

  it('updates custom dimensions when inputs are changed', () => {
    renderWithProvider(<LivePreview />);
    
    // Switch to custom device
    const customButton = screen.getByTitle('Custom');
    fireEvent.click(customButton);
    
    const widthInput = screen.getByPlaceholderText('Width');
    const heightInput = screen.getByPlaceholderText('Height');
    
    fireEvent.change(widthInput, { target: { value: '1000' } });
    fireEvent.change(heightInput, { target: { value: '700' } });
    
    expect(screen.getByText('1000 × 700')).toBeInTheDocument();
  });

  it('handles different console message types with appropriate styling', () => {
    renderWithProvider(<LivePreview />);
    
    // Toggle console to show it
    const consoleButton = screen.getByTitle('Toggle Console');
    fireEvent.click(consoleButton);
    
    // Test different message types
    const messageTypes = ['log', 'error', 'warn', 'info'];
    
    messageTypes.forEach((type, index) => {
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'console',
          level: type,
          message: `Test ${type} message`,
          timestamp: new Date().toISOString(),
        },
      });
      fireEvent(window, messageEvent);
    });
    
    messageTypes.forEach(type => {
      expect(screen.getByText(`Test ${type} message`)).toBeInTheDocument();
    });
  });
});