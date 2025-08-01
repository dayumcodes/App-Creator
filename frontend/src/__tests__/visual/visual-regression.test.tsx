import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authSlice from '../../store/slices/authSlice';

// Import components for visual testing
import Login from '../../pages/Login';
import Register from '../../pages/Register';
import ProjectList from '../../components/ProjectList';
import MonacoEditor from '../../components/MonacoEditor';
import LivePreview from '../../components/LivePreview';
import Header from '../../components/Header';
import PromptInput from '../../components/PromptInput';

// Mock store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isLoading: false,
        error: null,
        ...initialState.auth,
      },
    },
  });
};

// Test wrapper component
const TestWrapper = ({ children, initialState = {} }: any) => {
  const store = createMockStore(initialState);
  return (
    <Provider store={store}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Provider>
  );
};

describe('Visual Regression Tests', () => {
  // Mock data for consistent testing
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockProjects = [
    {
      id: '1',
      name: 'Test Project 1',
      description: 'A test project for visual regression testing',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Test Project 2',
      description: 'Another test project with a longer description to test text wrapping and layout',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  const mockFiles = [
    {
      id: '1',
      filename: 'index.html',
      content: '<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>',
      type: 'html' as const,
    },
    {
      id: '2',
      filename: 'style.css',
      content: 'body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }',
      type: 'css' as const,
    },
    {
      id: '3',
      filename: 'script.js',
      content: 'console.log("Hello from JavaScript!");',
      type: 'js' as const,
    },
  ];

  describe('Authentication Pages', () => {
    it('should render login page consistently', () => {
      const { container } = render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      );

      // Verify key elements are present
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();

      // Take snapshot for visual regression
      expect(container.firstChild).toMatchSnapshot('login-page');
    });

    it('should render login page with error state', () => {
      const { container } = render(
        <TestWrapper initialState={{
          auth: { error: 'Invalid credentials' }
        }}>
          <Login />
        </TestWrapper>
      );

      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('login-page-with-error');
    });

    it('should render login page in loading state', () => {
      const { container } = render(
        <TestWrapper initialState={{
          auth: { isLoading: true }
        }}>
          <Login />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /login/i })).toBeDisabled();
      expect(container.firstChild).toMatchSnapshot('login-page-loading');
    });

    it('should render register page consistently', () => {
      const { container } = render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();

      expect(container.firstChild).toMatchSnapshot('register-page');
    });
  });

  describe('Header Component', () => {
    it('should render header when user is not logged in', () => {
      const { container } = render(
        <TestWrapper>
          <Header />
        </TestWrapper>
      );

      expect(screen.getByText(/lovable clone/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('header-logged-out');
    });

    it('should render header when user is logged in', () => {
      const { container } = render(
        <TestWrapper initialState={{
          auth: { user: mockUser, token: 'mock-token' }
        }}>
          <Header />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.username)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('header-logged-in');
    });
  });

  describe('Project List Component', () => {
    it('should render empty project list', () => {
      const { container } = render(
        <TestWrapper>
          <ProjectList projects={[]} onProjectSelect={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('project-list-empty');
    });

    it('should render project list with projects', () => {
      const { container } = render(
        <TestWrapper>
          <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('project-list-with-projects');
    });

    it('should render project list in loading state', () => {
      const { container } = render(
        <TestWrapper>
          <ProjectList projects={[]} onProjectSelect={() => {}} isLoading={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('project-list-loading');
    });
  });

  describe('Monaco Editor Component', () => {
    // Mock Monaco Editor since it's complex to test visually
    beforeEach(() => {
      // Mock the Monaco Editor component
      jest.mock('@monaco-editor/react', () => ({
        __esModule: true,
        default: ({ value, language, theme }: any) => (
          <div 
            data-testid="monaco-editor"
            data-language={language}
            data-theme={theme}
            style={{ 
              width: '100%', 
              height: '400px', 
              border: '1px solid #ccc',
              fontFamily: 'monospace',
              padding: '10px',
              backgroundColor: theme === 'vs-dark' ? '#1e1e1e' : '#ffffff',
              color: theme === 'vs-dark' ? '#d4d4d4' : '#000000',
            }}
          >
            {value}
          </div>
        ),
      }));
    });

    it('should render Monaco editor with HTML content', () => {
      const { container } = render(
        <TestWrapper>
          <MonacoEditor
            files={mockFiles}
            activeFile="index.html"
            onFileChange={() => {}}
            onFileSelect={() => {}}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('monaco-editor-html');
    });

    it('should render Monaco editor with JavaScript content', () => {
      const { container } = render(
        <TestWrapper>
          <MonacoEditor
            files={mockFiles}
            activeFile="script.js"
            onFileChange={() => {}}
            onFileSelect={() => {}}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'javascript');
      expect(container.firstChild).toMatchSnapshot('monaco-editor-javascript');
    });

    it('should render Monaco editor in dark theme', () => {
      const { container } = render(
        <TestWrapper>
          <MonacoEditor
            files={mockFiles}
            activeFile="style.css"
            onFileChange={() => {}}
            onFileSelect={() => {}}
            theme="vs-dark"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-theme', 'vs-dark');
      expect(container.firstChild).toMatchSnapshot('monaco-editor-dark-theme');
    });
  });

  describe('Live Preview Component', () => {
    it('should render live preview with loading state', () => {
      const { container } = render(
        <TestWrapper>
          <LivePreview projectId="1" files={[]} isLoading={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('live-preview-loading');
    });

    it('should render live preview with error state', () => {
      const { container } = render(
        <TestWrapper>
          <LivePreview 
            projectId="1" 
            files={mockFiles} 
            isLoading={false}
            error="Failed to load preview"
          />
        </TestWrapper>
      );

      expect(screen.getByText(/failed to load preview/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('live-preview-error');
    });

    it('should render live preview iframe container', () => {
      const { container } = render(
        <TestWrapper>
          <LivePreview 
            projectId="1" 
            files={mockFiles} 
            isLoading={false}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('preview-iframe')).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('live-preview-iframe');
    });
  });

  describe('Prompt Input Component', () => {
    it('should render prompt input in initial state', () => {
      const { container } = render(
        <TestWrapper>
          <PromptInput
            onSubmit={() => {}}
            isLoading={false}
            suggestions={[]}
          />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText(/describe what you want to build/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('prompt-input-initial');
    });

    it('should render prompt input in loading state', () => {
      const { container } = render(
        <TestWrapper>
          <PromptInput
            onSubmit={() => {}}
            isLoading={true}
            suggestions={[]}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
      expect(container.firstChild).toMatchSnapshot('prompt-input-loading');
    });

    it('should render prompt input with suggestions', () => {
      const mockSuggestions = [
        'Create a landing page',
        'Build a todo app',
        'Make a portfolio website',
      ];

      const { container } = render(
        <TestWrapper>
          <PromptInput
            onSubmit={() => {}}
            isLoading={false}
            suggestions={mockSuggestions}
          />
        </TestWrapper>
      );

      mockSuggestions.forEach(suggestion => {
        expect(screen.getByText(suggestion)).toBeInTheDocument();
      });
      expect(container.firstChild).toMatchSnapshot('prompt-input-with-suggestions');
    });
  });

  describe('Responsive Design Tests', () => {
    beforeEach(() => {
      // Mock window.matchMedia for responsive tests
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    it('should render components consistently on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(
        <TestWrapper>
          <div className="mobile-layout">
            <Header />
            <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('mobile-layout');
    });

    it('should render components consistently on tablet viewport', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { container } = render(
        <TestWrapper>
          <div className="tablet-layout">
            <Header />
            <div style={{ display: 'flex' }}>
              <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
              <PromptInput onSubmit={() => {}} isLoading={false} suggestions={[]} />
            </div>
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('tablet-layout');
    });

    it('should render components consistently on desktop viewport', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      const { container } = render(
        <TestWrapper>
          <div className="desktop-layout">
            <Header />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px' }}>
              <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
              <MonacoEditor
                files={mockFiles}
                activeFile="index.html"
                onFileChange={() => {}}
                onFileSelect={() => {}}
              />
              <LivePreview projectId="1" files={mockFiles} isLoading={false} />
            </div>
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('desktop-layout');
    });
  });

  describe('Theme Consistency Tests', () => {
    it('should render components consistently in light theme', () => {
      const { container } = render(
        <TestWrapper>
          <div className="light-theme" data-theme="light">
            <Header />
            <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
            <PromptInput onSubmit={() => {}} isLoading={false} suggestions={[]} />
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('light-theme');
    });

    it('should render components consistently in dark theme', () => {
      const { container } = render(
        <TestWrapper>
          <div className="dark-theme" data-theme="dark">
            <Header />
            <ProjectList projects={mockProjects} onProjectSelect={() => {}} />
            <PromptInput onSubmit={() => {}} isLoading={false} suggestions={[]} />
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('dark-theme');
    });
  });

  describe('Error State Visual Tests', () => {
    it('should render error boundaries consistently', () => {
      // Mock console.error to prevent error logs in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowError = () => {
        throw new Error('Test error for visual regression');
      };

      const { container } = render(
        <TestWrapper>
          <div>
            <Header />
            <ThrowError />
          </div>
        </TestWrapper>
      );

      // The error boundary should catch the error and render fallback UI
      expect(container.firstChild).toMatchSnapshot('error-boundary-fallback');

      consoleSpy.mockRestore();
    });

    it('should render network error states consistently', () => {
      const { container } = render(
        <TestWrapper>
          <div className="network-error">
            <div className="error-message">
              <h2>Network Error</h2>
              <p>Unable to connect to the server. Please check your internet connection.</p>
              <button>Retry</button>
            </div>
          </div>
        </TestWrapper>
      );

      expect(container.firstChild).toMatchSnapshot('network-error-state');
    });
  });
});