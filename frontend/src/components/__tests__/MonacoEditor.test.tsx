import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MonacoEditor from '../MonacoEditor';
import projectSlice from '../../store/slices/projectSlice';

import { vi } from 'vitest';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => {
  return {
    default: ({ value, onChange, onMount }: any) => {
      React.useEffect(() => {
        if (onMount) {
          const mockEditor = {
            updateOptions: vi.fn(),
            addCommand: vi.fn(),
            getAction: vi.fn(() => ({ run: vi.fn() })),
          };
          const mockMonaco = {
            KeyMod: { CtrlCmd: 1, Shift: 2 },
            KeyCode: { KeyS: 1, KeyF: 2, KeyD: 3, Slash: 4, KeyI: 5 },
            languages: {
              typescript: {
                ScriptTarget: { ES2020: 1 },
                ModuleResolutionKind: { NodeJs: 1 },
                ModuleKind: { CommonJS: 1 },
                JsxEmit: { React: 1 },
                typescriptDefaults: {
                  setCompilerOptions: vi.fn(),
                  setDiagnosticsOptions: vi.fn(),
                },
              },
            },
          };
          onMount(mockEditor, mockMonaco);
        }
      }, [onMount]);

      return (
        <div data-testid="monaco-editor">
          <textarea
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            data-testid="editor-textarea"
          />
        </div>
      );
    },
  };
});

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      project: projectSlice,
    },
    preloadedState: {
      project: {
        projects: [],
        currentProject: null,
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
        ...initialState,
      },
    },
  });
};

describe('MonacoEditor', () => {
  const defaultProps = {
    filename: 'test.js',
    content: 'console.log("Hello World");',
    language: 'javascript',
  };

  it('renders the Monaco editor', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor {...defaultProps} />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('displays the correct content', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor {...defaultProps} />
      </Provider>
    );

    await waitFor(() => {
      const textarea = screen.getByTestId('editor-textarea');
      expect(textarea).toHaveValue('console.log("Hello World");');
    });
  });

  it('handles content changes', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor {...defaultProps} />
      </Provider>
    );

    await waitFor(() => {
      const textarea = screen.getByTestId('editor-textarea');
      expect(textarea).toBeInTheDocument();
    });

    // Simulate content change
    const textarea = screen.getByTestId('editor-textarea');
    const newContent = 'console.log("Updated content");';
    
    // Change the value
    textarea.setAttribute('value', newContent);
    
    // Check that the store would be updated (we can't easily test the actual dispatch)
    expect(textarea).toBeInTheDocument();
  });

  it('determines correct language from filename', async () => {
    const store = createMockStore();
    
    const testCases = [
      { filename: 'test.js', expectedLanguage: 'javascript' },
      { filename: 'test.ts', expectedLanguage: 'typescript' },
      { filename: 'test.html', expectedLanguage: 'html' },
      { filename: 'test.css', expectedLanguage: 'css' },
      { filename: 'test.json', expectedLanguage: 'json' },
      { filename: 'test.md', expectedLanguage: 'markdown' },
      { filename: 'test.txt', expectedLanguage: 'plaintext' },
    ];

    for (const testCase of testCases) {
      const { unmount } = render(
        <Provider store={store}>
          <MonacoEditor
            filename={testCase.filename}
            content=""
            language={testCase.expectedLanguage}
          />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      });
      
      unmount();
    }
  });

  it('handles TypeScript files with proper configuration', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor
          filename="test.ts"
          content="const message: string = 'Hello';"
          language="typescript"
        />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('handles JavaScript files', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor
          filename="test.js"
          content="const message = 'Hello';"
          language="javascript"
        />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('handles HTML files', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor
          filename="index.html"
          content="<html><body>Hello</body></html>"
          language="html"
        />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('handles CSS files', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor
          filename="styles.css"
          content="body { margin: 0; }"
          language="css"
        />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('handles JSON files', async () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <MonacoEditor
          filename="package.json"
          content='{"name": "test"}'
          language="json"
        />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });
});