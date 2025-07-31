import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error locally
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Report error to external service
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundaryLevel: this.props.level || 'component',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    };

    // Send to error reporting service
    this.sendErrorReport(errorData);
  };

  private sendErrorReport = async (errorData: any) => {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private getUserId = (): string | null => {
    // Get user ID from your auth system
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id || null;
    } catch {
      return null;
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const level = this.props.level || 'component';
      
      if (level === 'critical') {
        return (
          <div className="error-boundary error-boundary--critical">
            <div className="error-boundary__container">
              <div className="error-boundary__icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h1 className="error-boundary__title">Something went wrong</h1>
              <p className="error-boundary__message">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
              <div className="error-boundary__actions">
                <button 
                  className="error-boundary__button error-boundary__button--primary"
                  onClick={this.handleReload}
                >
                  Reload Page
                </button>
                <button 
                  className="error-boundary__button error-boundary__button--secondary"
                  onClick={this.handleGoHome}
                >
                  Go Home
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <details className="error-boundary__details">
                  <summary>Error Details (Development)</summary>
                  <pre className="error-boundary__error-text">
                    {this.state.error?.stack}
                  </pre>
                  <pre className="error-boundary__error-text">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      }

      if (level === 'page') {
        return (
          <div className="error-boundary error-boundary--page">
            <div className="error-boundary__container">
              <div className="error-boundary__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <triangle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2 className="error-boundary__title">Page Error</h2>
              <p className="error-boundary__message">
                This page encountered an error. You can try refreshing or go back.
              </p>
              <div className="error-boundary__actions">
                <button 
                  className="error-boundary__button error-boundary__button--primary"
                  onClick={this.handleRetry}
                >
                  Try Again
                </button>
                <button 
                  className="error-boundary__button error-boundary__button--secondary"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Component level error
      return (
        <div className="error-boundary error-boundary--component">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="error-boundary__content">
              <h3 className="error-boundary__title">Component Error</h3>
              <p className="error-boundary__message">
                This component failed to load properly.
              </p>
              <button 
                className="error-boundary__button error-boundary__button--small"
                onClick={this.handleRetry}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  const reportError = React.useCallback((error: Error, context?: Record<string, any>) => {
    console.error('Error reported via useErrorHandler:', error);
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    fetch('/api/errors/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
    }).catch(reportingError => {
      console.error('Failed to report error:', reportingError);
    });
  }, []);

  return { reportError };
}