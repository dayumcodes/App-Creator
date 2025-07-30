import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { usePreview } from '../usePreview';
import projectReducer from '../../store/slices/projectSlice';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    generateShareableUrl: vi.fn(),
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-url');
global.URL.revokeObjectURL = vi.fn();

const createMockStore = (currentProject: any = null) => {
  return configureStore({
    reducer: {
      project: projectReducer,
    },
    preloadedState: {
      project: {
        projects: [],
        currentProject,
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

const wrapper = (store: any) => ({ children }: { children: React.ReactNode }) =>
  React.createElement(Provider, { store, children });

describe('usePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state when no project is selected', () => {
    const store = createMockStore();
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.previewUrl).toBe(null);
    expect(result.current.lastUpdated).toBe(null);
  });

  it('generates preview content for project with HTML file', async () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    // Wait for the effect to run
    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.previewUrl).toBe('blob:http://localhost:3000/test-url');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('generates preview content with CSS and JS files', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      files: [
        {
          id: '1',
          filename: 'index.html',
          content: '<html><head></head><body><h1>Hello World</h1></body></html>',
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
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.previewUrl).toBe('blob:http://localhost:3000/test-url');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(
      expect.any(Blob)
    );
  });

  it('generates default HTML when no HTML file exists', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      files: [
        {
          id: '1',
          filename: 'style.css',
          content: 'body { color: red; }',
          type: 'CSS' as const,
        },
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.previewUrl).toBe('blob:http://localhost:3000/test-url');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles empty project files', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      files: [],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.previewUrl).toBe('blob:http://localhost:3000/test-url');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('refreshes preview when refresh function is called', async () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    const initialCallCount = (global.URL.createObjectURL as any).mock.calls.length;

    act(() => {
      result.current.refresh();
    });

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(initialCallCount + 1);
  });

  it('generates shareable URL using API service', async () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const mockApiResponse = {
      data: {
        shareUrl: 'http://example.com/preview/share/abc123',
        expiresAt: '2023-01-02T00:00:00Z',
      },
    };

    (apiService.generateShareableUrl as any).mockResolvedValue(mockApiResponse);

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    let shareableUrl: string | null = null;
    await act(async () => {
      shareableUrl = await result.current.generateShareableUrl();
    });

    expect(apiService.generateShareableUrl).toHaveBeenCalledWith('1');
    expect(shareableUrl).toBe('http://example.com/preview/share/abc123');
  });

  it('returns null shareable URL when no project exists', async () => {
    const store = createMockStore();
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    let shareableUrl: string | null = null;
    await act(async () => {
      shareableUrl = await result.current.generateShareableUrl();
    });

    expect(shareableUrl).toBe(null);
    expect(apiService.generateShareableUrl).not.toHaveBeenCalled();
  });

  it('handles API errors when generating shareable URL', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      files: [],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const mockApiResponse = {
      error: 'Failed to generate share URL',
    };

    (apiService.generateShareableUrl as any).mockResolvedValue(mockApiResponse);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    let shareableUrl: string | null = null;
    await act(async () => {
      shareableUrl = await result.current.generateShareableUrl();
    });

    expect(shareableUrl).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate shareable URL:', 'Failed to generate share URL');

    consoleSpy.mockRestore();
  });

  it('handles network errors when generating shareable URL', async () => {
    const mockProject = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      files: [],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    (apiService.generateShareableUrl as any).mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    let shareableUrl: string | null = null;
    await act(async () => {
      shareableUrl = await result.current.generateShareableUrl();
    });

    expect(shareableUrl).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate shareable URL:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('handles auto-refresh with custom delay', () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    renderHook(() => usePreview({ autoRefresh: true, refreshDelay: 500 }), {
      wrapper: wrapper(store),
    });

    // Fast-forward time by 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('disables auto-refresh when autoRefresh is false', () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    renderHook(() => usePreview({ autoRefresh: false }), {
      wrapper: wrapper(store),
    });

    const initialCallCount = (global.URL.createObjectURL as any).mock.calls.length;

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should only be called once for initial load, not for auto-refresh
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(initialCallCount);
  });

  it('cleans up blob URLs on unmount', () => {
    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { unmount } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3000/test-url');
  });

  it('handles errors during preview generation', async () => {
    // Reset the mock and make it throw an error
    vi.clearAllMocks();
    (global.URL.createObjectURL as any).mockImplementation(() => {
      throw new Error('Failed to create blob URL');
    });

    const mockProject = {
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
      ],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const store = createMockStore(mockProject);
    const { result } = renderHook(() => usePreview(), {
      wrapper: wrapper(store),
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.error).toBe('Failed to create blob URL');
    expect(result.current.previewUrl).toBe(null);
  });
});