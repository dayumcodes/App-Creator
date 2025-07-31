export interface ErrorContext {
  userId?: string;
  projectId?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class FrontendErrorHandler {
  private static instance: FrontendErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private isOnline = navigator.onLine;
  private retryAttempts = 3;
  private retryDelay = 1000;

  private constructor() {
    this.setupGlobalErrorHandlers();
    this.setupNetworkListeners();
  }

  public static getInstance(): FrontendErrorHandler {
    if (!FrontendErrorHandler.instance) {
      FrontendErrorHandler.instance = new FrontendErrorHandler();
    }
    return FrontendErrorHandler.instance;
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(new Error(event.message), {
        action: 'global_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      }, 'high');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(`Unhandled promise rejection: ${event.reason}`),
        {
          action: 'unhandled_promise_rejection',
          metadata: { reason: event.reason },
        },
        'high'
      );
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.handleError(
          new Error(`Resource failed to load: ${target.tagName}`),
          {
            action: 'resource_load_error',
            metadata: {
              tagName: target.tagName,
              src: (target as any).src || (target as any).href,
            },
          },
          'medium'
        );
      }
    }, true);
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  public handleError(
    error: Error,
    context?: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled:', errorReport);
    }

    // Add to queue for reporting
    this.errorQueue.push(errorReport);

    // Try to send immediately if online
    if (this.isOnline) {
      this.flushErrorQueue();
    }

    // Show user notification for critical errors
    if (severity === 'critical') {
      this.showErrorNotification(error.message);
    }
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await this.sendErrorReports(errors);
    } catch (error) {
      // If sending fails, add errors back to queue
      this.errorQueue.unshift(...errors);
      console.error('Failed to send error reports:', error);
    }
  }

  private async sendErrorReports(errors: ErrorReport[]): Promise<void> {
    let attempts = 0;
    
    while (attempts < this.retryAttempts) {
      try {
        const response = await fetch('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ errors }),
        });

        if (response.ok) {
          return; // Success
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        attempts++;
        
        if (attempts >= this.retryAttempts) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
      }
    }
  }

  private showErrorNotification(message: string): void {
    // Create a simple notification for critical errors
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="error-notification__content">
        <strong>Error:</strong> ${message}
        <button class="error-notification__close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  public reportUserAction(action: string, context?: ErrorContext): void {
    // Track user actions for debugging context
    const actionData = {
      action,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Store recent actions for error context
    const recentActions = JSON.parse(
      sessionStorage.getItem('recentActions') || '[]'
    );
    
    recentActions.push(actionData);
    
    // Keep only last 10 actions
    if (recentActions.length > 10) {
      recentActions.shift();
    }
    
    sessionStorage.setItem('recentActions', JSON.stringify(recentActions));
  }

  public getRecentActions(): any[] {
    return JSON.parse(sessionStorage.getItem('recentActions') || '[]');
  }

  public clearErrorQueue(): void {
    this.errorQueue = [];
  }

  public getQueueSize(): number {
    return this.errorQueue.length;
  }
}

// Export singleton instance
export const errorHandler = FrontendErrorHandler.getInstance();

// Utility functions for common error scenarios
export const handleApiError = (error: any, context?: ErrorContext) => {
  let message = 'An API error occurred';
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  if (error.response) {
    // HTTP error response
    message = error.response.data?.error?.message || `HTTP ${error.response.status}`;
    severity = error.response.status >= 500 ? 'high' : 'medium';
  } else if (error.request) {
    // Network error
    message = 'Network error - please check your connection';
    severity = 'high';
  } else {
    // Other error
    message = error.message || 'Unknown API error';
  }

  errorHandler.handleError(new Error(message), {
    ...context,
    action: 'api_error',
    metadata: {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
    },
  }, severity);
};

export const handleValidationError = (errors: Record<string, string>, context?: ErrorContext) => {
  const message = `Validation failed: ${Object.keys(errors).join(', ')}`;
  
  errorHandler.handleError(new Error(message), {
    ...context,
    action: 'validation_error',
    metadata: { validationErrors: errors },
  }, 'low');
};

export const handleAsyncError = async <T>(
  asyncFn: () => Promise<T>,
  context?: ErrorContext
): Promise<T | null> => {
  try {
    return await asyncFn();
  } catch (error) {
    errorHandler.handleError(error as Error, {
      ...context,
      action: 'async_operation_error',
    });
    return null;
  }
};