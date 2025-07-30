import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import PromptSuggestions from '../PromptSuggestions';
import authReducer from '../../store/slices/authSlice';
import projectReducer from '../../store/slices/projectSlice';
import uiReducer from '../../store/slices/uiSlice';
import promptReducer from '../../store/slices/promptSlice';

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

const mockSuggestions = [
  { id: '1', text: 'Create a responsive navigation bar', category: 'ui' as const },
  { id: '2', text: 'Add a contact form with validation', category: 'functionality' as const },
  { id: '3', text: 'Style the page with a modern color scheme', category: 'styling' as const },
  { id: '4', text: 'Create a product catalog with filtering', category: 'data' as const },
];

const renderWithStore = (store: any, onSelect = vi.fn()) => {
  return render(
    <Provider store={store}>
      <PromptSuggestions onSelect={onSelect} />
    </Provider>
  );
};

describe('PromptSuggestions', () => {
  it('renders suggestions header', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('💡 Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Click on any suggestion to use it as your prompt')).toBeInTheDocument();
  });

  it('renders suggestions grouped by category', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    // Check category headers
    expect(screen.getByText('Ui')).toBeInTheDocument();
    expect(screen.getByText('Functionality')).toBeInTheDocument();
    expect(screen.getByText('Styling')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();

    // Check category icons
    expect(screen.getByText('🎨')).toBeInTheDocument();
    expect(screen.getByText('⚙️')).toBeInTheDocument();
    expect(screen.getByText('💅')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('renders all suggestion items', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Create a responsive navigation bar')).toBeInTheDocument();
    expect(screen.getByText('Add a contact form with validation')).toBeInTheDocument();
    expect(screen.getByText('Style the page with a modern color scheme')).toBeInTheDocument();
    expect(screen.getByText('Create a product catalog with filtering')).toBeInTheDocument();
  });

  it('calls onSelect when suggestion is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store, mockOnSelect);

    const suggestionButton = screen.getByText('Create a responsive navigation bar');
    await user.click(suggestionButton);

    expect(mockOnSelect).toHaveBeenCalledWith('Create a responsive navigation bar');
  });

  it('renders tip in footer', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('Tip:')).toBeInTheDocument();
    expect(screen.getByText(/Be specific about what you want to create/)).toBeInTheDocument();
  });

  it('renders empty state when no suggestions', () => {
    const store = createTestStore({
      prompt: {
        suggestions: [],
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    expect(screen.getByText('💡 Suggestions')).toBeInTheDocument();
    // Should still show header and footer even with no suggestions
    expect(screen.getByText('Click on any suggestion to use it as your prompt')).toBeInTheDocument();
  });

  it('applies correct styling to category headers', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const uiCategory = screen.getByText('Ui').closest('.category-header');
    const functionalityCategory = screen.getByText('Functionality').closest('.category-header');
    const stylingCategory = screen.getByText('Styling').closest('.category-header');
    const dataCategory = screen.getByText('Data').closest('.category-header');

    expect(uiCategory).toHaveStyle('border-left-color: #3b82f6');
    expect(functionalityCategory).toHaveStyle('border-left-color: #10b981');
    expect(stylingCategory).toHaveStyle('border-left-color: #f59e0b');
    expect(dataCategory).toHaveStyle('border-left-color: #8b5cf6');
  });

  it('shows arrow indicator on suggestion items', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const arrowIndicators = screen.getAllByText('→');
    expect(arrowIndicators).toHaveLength(mockSuggestions.length);
  });

  it('has proper accessibility attributes', () => {
    const store = createTestStore({
      prompt: {
        suggestions: mockSuggestions,
        currentPrompt: '',
        isGenerating: false,
        isStreaming: false,
        streamingContent: '',
        history: [],
        error: null,
        typingIndicator: false,
      },
    });

    renderWithStore(store);

    const suggestionButton = screen.getByText('Create a responsive navigation bar').closest('button');
    expect(suggestionButton).toHaveAttribute('title', 'Click to use: Create a responsive navigation bar');
  });
});