import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import PromptHistory from '../PromptHistory';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';
import promptReducer from '../../store/slices/promptSlice';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api');
const mockedApiService = apiService as any;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      project: projectReducer,
      ui: uiReducer,
      prompt: promptReducer,
    },
    preloadedState: initialState,
  });
};

const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'Test Description',
  files: [],
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockHistory = [
  {
    id: '1',
    prompt: 'Create a navigation bar',
    response: 'Navigation bar created',
    filesChanged: ['index.html', 'style.css'],
    createdAt: '2023-01-01T12:00:00Z',
  },
  {
    id: '2',
    prompt: 'Add a footer section',
    response: 'Footer section added',
    filesChanged: ['index.html'],
    createdAt: '2023-01-01T11:00:00Z',
  },
  {
    id: '3',
    prompt: 'Style the buttons with modern design',
    response: 'Button styles updated',
    filesChanged: ['style.css'],
    createdAt: '2023-01-01T10:00:00Z',
  },
];

const renderWithStore = (store: any, onSelect = vi.fn()) => {
  return render(
    <Provider store={store}>
      <PromptHistory onSelect={onSelect} />
    </Provider>
  );
};

describe('PromptHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no project is selected', () => {
    const store = createTestStore();
    renderWithStore(store);

    expect(screen.getByText('Select a project to view prompt history')).toBeInTheDocument();
  });

  it('renders history header when project is selected', () => {
    mockedApiService.getPromptHistory = vi.fn().mockResolvedValue({ data: [] });
    
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: [],
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('📝 Prompt History')).toBeInTheDocument();
    expect(screen.getByTitle('Refresh history')).toBeInTheDocument();
  });

  it('loads history on mount when project is selected and history is empty', async () => {
    mockedApiService.getPromptHistory = vi.fn().mockResolvedValue({
      data: mockHistory,
    });

    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: [],
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    await waitFor(() => {
      expect(mockedApiService.getPromptHistory).toHaveBeenCalledWith('1');
    });
  });

  it('renders history items', () => {
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Create a navigation bar')).toBeInTheDocument();
    expect(screen.getByText('Add a footer section')).toBeInTheDocument();
    expect(screen.getByText('Style the buttons with modern design')).toBeInTheDocument();
  });

  it('shows files changed for each history item', () => {
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('2 files changed')).toBeInTheDocument();
    expect(screen.getByText('1 file changed')).toBeInTheDocument();
    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.getByText('style.css')).toBeInTheDocument();
  });

  it('calls onSelect when "Use prompt" button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store, mockOnSelect);

    const usePromptButtons = screen.getAllByText('Use prompt');
    await user.click(usePromptButtons[0]);

    expect(mockOnSelect).toHaveBeenCalledWith('Create a navigation bar');
  });

  it('copies prompt to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const copyButtons = screen.getAllByTitle('Copy prompt');
    await user.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Create a navigation bar');
  });

  it('filters history based on search query', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const searchInput = screen.getByPlaceholderText('Search prompts...');
    await user.type(searchInput, 'navigation');

    expect(screen.getByText('Create a navigation bar')).toBeInTheDocument();
    expect(screen.queryByText('Add a footer section')).not.toBeInTheDocument();
    expect(screen.queryByText('Style the buttons with modern design')).not.toBeInTheDocument();
  });

  it('shows empty search results message', async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const searchInput = screen.getByPlaceholderText('Search prompts...');
    await user.type(searchInput, 'nonexistent');

    expect(screen.getByText('No prompts found matching "nonexistent"')).toBeInTheDocument();
  });

  it('shows empty history message when no history exists', () => {
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: [],
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('No prompt history yet')).toBeInTheDocument();
    expect(screen.getByText('Your previous prompts will appear here')).toBeInTheDocument();
  });

  it('shows loading state when fetching history', () => {
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: [],
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    // Mock loading state
    mockedApiService.getPromptHistory.mockImplementation(() => new Promise(() => {}));

    renderWithStore(store);

    expect(screen.getByText('Loading history...')).toBeInTheDocument();
  });

  it('clears history when clear button is clicked and confirmed', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);

    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const clearButton = screen.getByTitle('Clear all history');
    await user.click(clearButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to clear all prompt history? This action cannot be undone.'
    );
    expect(store.getState().prompt.history).toEqual([]);
  });

  it('does not clear history when clear is cancelled', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);

    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const clearButton = screen.getByTitle('Clear all history');
    await user.click(clearButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(store.getState().prompt.history).toEqual(mockHistory);
  });

  it('truncates long prompts', () => {
    const longPromptHistory = [
      {
        id: '1',
        prompt: 'This is a very long prompt that should be truncated because it exceeds the maximum length that we want to display in the history list',
        response: 'Response',
        filesChanged: ['index.html'],
        createdAt: '2023-01-01T12:00:00Z',
      },
    ];

    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: longPromptHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText(/This is a very long prompt that should be truncated.../)).toBeInTheDocument();
  });

  it('shows history count in footer', () => {
    const store = createTestStore({
      project: {
        currentProject: mockProject,
        projects: [mockProject],
        activeFile: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      prompt: {
        history: mockHistory,
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Showing 3 of 3 prompts')).toBeInTheDocument();
  });
});