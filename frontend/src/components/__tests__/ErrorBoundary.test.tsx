import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '../ErrorBoundary';

// Mock fetch for error reporting
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that uses useErrorHandler hook
const ComponentWithErrorHandler: React.FC = () => {
  const { reportError } = useErrorHandler();
  
  const handleClick = () => {
    reportError(new Error('Manual error'), { component: 'test' });
  };
  
  return <button onClick={handleClick}>Report Error</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Catching', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should catch and display error when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('This component failed to load properly.')).toBeInTheDocument();
    });

    it('should call custom error handler when provided', () => {
      const onError = vi.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('Error Levels', () => {
    it('should render critical error UI', () => {
      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('should render page error UI', () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should render component error UI by default', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should retry and render children after error recovery', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();

      // Click retry button
      fireEvent.click(screen.getByText('Retry'));

      // Rerender with no error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should reload page when reload button is clicked', () => {
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Reload Page'));
      expect(mockReload).toHaveBeenCalled();
    });

    it('should navigate home when go home button is clicked', () => {
      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Go Home'));
      expect(window.location.href).toBe('/');
    });
  });

  describe('Error Reporting', () => {
    it('should report error to API endpoint', async () => {
      mockLocalStorage.getItem.mockReturnValue('{"id":"user123"}');

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"message":"Test error"'),
        });
      });
    });

    it('should handle error reporting failure gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still render error UI even if reporting fails
      expect(screen.getByText('Component Error')).toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    it('should show error details in development mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not show error details in production mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument();

      process.env['NODE_ENV'] = originalEnv;
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowError, { level: 'page' });

    render(<WrappedComponent shouldThrow={true} />);

    expect(screen.getByText('Page Error')).toBeInTheDocument();
  });

  it('should pass props to wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowError);

    render(<WrappedComponent shouldThrow={false} />);

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should set correct display name', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    
    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });
});

describe('useErrorHandler hook', () => {
  it('should report error when called', async () => {
    render(<ComponentWithErrorHandler />);

    fireEvent.click(screen.getByText('Report Error'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"message":"Manual error"'),
      });
    });
  });

  it('should handle reporting failure gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ComponentWithErrorHandler />);

    fireEvent.click(screen.getByText('Report Error'));

    // Should not throw or crash the component
    expect(screen.getByText('Report Error')).toBeInTheDocument();
  });
});