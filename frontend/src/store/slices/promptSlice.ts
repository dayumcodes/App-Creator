import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PromptHistory {
  id: string;
  prompt: string;
  response: string;
  filesChanged: string[];
  createdAt: string;
}

interface PromptSuggestion {
  id: string;
  text: string;
  category: 'ui' | 'functionality' | 'styling' | 'data';
}

interface PromptState {
  currentPrompt: string;
  isGenerating: boolean;
  isStreaming: boolean;
  streamingContent: string;
  history: PromptHistory[];
  suggestions: PromptSuggestion[];
  error: string | null;
  typingIndicator: boolean;
}

const defaultSuggestions: PromptSuggestion[] = [
  { id: '1', text: 'Create a responsive navigation bar', category: 'ui' },
  { id: '2', text: 'Add a contact form with validation', category: 'functionality' },
  { id: '3', text: 'Style the page with a modern color scheme', category: 'styling' },
  { id: '4', text: 'Create a user dashboard with cards', category: 'ui' },
  { id: '5', text: 'Add dark mode toggle functionality', category: 'functionality' },
  { id: '6', text: 'Implement a responsive grid layout', category: 'styling' },
  { id: '7', text: 'Create a product catalog with filtering', category: 'data' },
  { id: '8', text: 'Add smooth scroll animations', category: 'functionality' },
];

const initialState: PromptState = {
  currentPrompt: '',
  isGenerating: false,
  isStreaming: false,
  streamingContent: '',
  history: [],
  suggestions: defaultSuggestions,
  error: null,
  typingIndicator: false,
};

const promptSlice = createSlice({
  name: 'prompt',
  initialState,
  reducers: {
    setCurrentPrompt: (state, action: PayloadAction<string>) => {
      state.currentPrompt = action.payload;
    },
    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload;
      if (!action.payload) {
        state.isStreaming = false;
        state.streamingContent = '';
        state.typingIndicator = false;
      }
    },
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
      if (!action.payload) {
        state.streamingContent = '';
      }
    },
    appendStreamingContent: (state, action: PayloadAction<string>) => {
      state.streamingContent += action.payload;
    },
    setStreamingContent: (state, action: PayloadAction<string>) => {
      state.streamingContent = action.payload;
    },
    addToHistory: (state, action: PayloadAction<PromptHistory>) => {
      state.history.unshift(action.payload);
      // Keep only the last 50 entries
      if (state.history.length > 50) {
        state.history = state.history.slice(0, 50);
      }
    },
    setHistory: (state, action: PayloadAction<PromptHistory[]>) => {
      state.history = action.payload;
    },
    clearHistory: (state) => {
      state.history = [];
    },
    setSuggestions: (state, action: PayloadAction<PromptSuggestion[]>) => {
      state.suggestions = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setTypingIndicator: (state, action: PayloadAction<boolean>) => {
      state.typingIndicator = action.payload;
    },
    clearPrompt: (state) => {
      state.currentPrompt = '';
    },
  },
});

export const {
  setCurrentPrompt,
  setGenerating,
  setStreaming,
  appendStreamingContent,
  setStreamingContent,
  addToHistory,
  setHistory,
  clearHistory,
  setSuggestions,
  setError,
  clearError,
  setTypingIndicator,
  clearPrompt,
} = promptSlice.actions;

export default promptSlice.reducer;
export type { PromptHistory, PromptSuggestion };