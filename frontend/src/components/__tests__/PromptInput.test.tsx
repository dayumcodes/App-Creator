import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import PromptInput from '../PromptInput';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';
import promptReducer from '../../store/slices/promptSlice';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api');
const mockedApiService = apiService as any;

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
  files: [
    {
      id: '1',
      filename: 'index.html',
      content: '<html></html>',
      type: 'HTML' as const,
    },
  ],
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const renderWithStore = (store: any) => {
  return render(
    <Provider store={store}>
      <PromptInput />
    </Provider>
  );
};

describe('PromptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ReadableStream to be undefined to disable streaming
    Object.defineProperty(window, 'ReadableStream', {
      value: undefined,
      writable: true,
    });
  });

  it('renders empty state when no project is selected', () => {
    const store = createTestStore();
    renderWithStore(store);

    expect(screen.getByText('Select a project to start generating code with AI')).toBeInTheDocument();
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('renders prompt input when project is selected', () => {
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
    });

    renderWithStore(store);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe what you want to build/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('handles prompt input changes', async () => {
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
    });

    renderWithStore(store);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    await user.type(textarea, 'Create a button');

    expect(textarea).toHaveValue('Create a button');
  });

  it('shows typing indicator when typing', async () => {
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
    });

    renderWithStore(store);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    await user.type(textarea, 'Test');

    // Check if typing indicator appears
    expect(document.querySelector('.typing-indicator')).toBeInTheDocument();
  });

  it('submits prompt on button click', async () => {
    const user = userEvent.setup();
    
    mockedApiService.generateCode = vi.fn().mockResolvedValue({
      data: {
        files: mockProject.files,
        promptHistory: {
          id: '1',
          prompt: 'Create a button',
          response: 'Button created',
          filesChanged: ['index.html'],
          createdAt: '2023-01-01T00:00:00Z',
        },
      },
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
        currentPrompt: 'Create a button',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        suggestions: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const submitButton = screen.getByRole('button', { name: 'Generate' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApiService.generateCode).toHaveBeenCalledWith('1', 'Create a button');
    });
  });

  it('submits prompt on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    
    mockedApiService.generateCode = vi.fn().mockResolvedValue({
      data: {
        files: mockProject.files,
        promptHistory: {
          id: '1',
          prompt: 'Create a button',
          response: 'Button created',
          filesChanged: ['index.html'],
          createdAt: '2023-01-01T00:00:00Z',
        },
      },
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
        currentPrompt: 'Create a button',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        suggestions: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(mockedApiService.generateCode).toHaveBeenCalledWith('1', 'Create a button');
    });
  });

  it('disables input during generation', async () => {
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
        currentPrompt: '',
        isGenerating: true,
        isStreaming: false,
        streamingContent: '',
        history: [],
        suggestions: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    const submitButton = screen.getByRole('button', { name: /Processing/ });

    expect(textarea).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('shows error message when generation fails', () => {
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
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        suggestions: [],
        error: 'Generation failed',
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Generation failed')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('clears error when close button is clicked', async () => {
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
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        suggestions: [],
        error: 'Generation failed',
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const closeButton = screen.getByRole('button', { name: '×' });
    await user.click(closeButton);

    // Error should be cleared from state
    expect(store.getState().prompt.error).toBeNull();
  });

  it('shows streaming content during generation', () => {
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
        currentPrompt: '',
        isGenerating: true,
        isStreaming: true,
        streamingContent: 'Generating HTML...',
        history: [],
        suggestions: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Live Generation')).toBeInTheDocument();
    expect(screen.getByText('Generating HTML...')).toBeInTheDocument();
    expect(screen.getByText('Streaming...')).toBeInTheDocument();
  });

  it('toggles suggestions panel', async () => {
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
    });

    renderWithStore(store);

    const suggestionsButton = screen.getByRole('button', { name: /Suggestions/ });
    await user.click(suggestionsButton);

    expect(screen.getAllByText('💡 Suggestions')).toHaveLength(2); // Button and header
  });

  it('toggles history panel', async () => {
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
    });

    renderWithStore(store);

    const historyButton = screen.getByRole('button', { name: /History/ });
    await user.click(historyButton);

    expect(screen.getByText('📝 Prompt History')).toBeInTheDocument();
  });

  it('prevents submission with empty prompt', async () => {
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
    });

    renderWithStore(store);

    const submitButton = screen.getByRole('button', { name: 'Generate' });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(mockedApiService.generateCode).not.toHaveBeenCalled();
  });
});