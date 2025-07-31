import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from './logger';

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  action?: string;
  metadata?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorReporter {
  private static instance: ErrorReporter;
  private initialized = false;

  private constructor() {}

  public static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  public initialize(): void {
    if (this.initialized) return;

    const dsn = process.env['SENTRY_DSN'];
    if (!dsn) {
      logger.warn('Sentry DSN not configured. Error reporting will use local logging only.');
      this.initialized = true;
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env['NODE_ENV'] || 'development',
      integrations: [
        nodeProfilingIntegration(),
      ],
      profilesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
      tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
      beforeSend: (event) => {
        // Filter out sensitive information
        if (event.request?.data) {
          const data = event.request.data as any;
          if (data.password) data.password = '[Filtered]';
          if (data.token) data.token = '[Filtered]';
          if (data.apiKey) data.apiKey = '[Filtered]';
        }
        return event;
      },
    });

    this.initialized = true;
    logger.info('Error reporting initialized with Sentry');
  }

  public reportError(error: Error, context?: ErrorContext): void {
    // Log locally
    logger.error('Error reported', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    if (!this.initialized) {
      return;
    }

    // Set user context if available
    if (context?.userId) {
      Sentry.setUser({ id: context.userId });
    }

    // Set additional context
    if (context) {
      Sentry.setContext('error_context', {
        projectId: context.projectId,
        action: context.action,
        severity: context.severity || 'medium',
        metadata: context.metadata,
      });
    }

    // Set severity level
    const level = this.mapSeverityToSentryLevel(context?.severity || 'medium');
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      Sentry.captureException(error);
    });
  }

  public reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    const logLevel = level === 'warning' ? 'warn' : level;
    (logger as any)[logLevel](message, { context });

    if (!this.initialized) {
      return;
    }

    if (context?.userId) {
      Sentry.setUser({ id: context.userId });
    }

    if (context) {
      Sentry.setContext('message_context', context as Record<string, unknown>);
    }

    const sentryLevel = level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info';
    Sentry.captureMessage(message, sentryLevel);
  }

  public addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    logger.debug(`Breadcrumb: ${category} - ${message}`, data);

    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      data: data || {},
      timestamp: Date.now() / 1000,
    });
  }

  public setUserContext(userId: string, email?: string, username?: string): void {
    if (!this.initialized) {
      return;
    }

    const user: any = { id: userId };
    if (email) user.email = email;
    if (username) user.username = username;
    Sentry.setUser(user);
  }

  public clearUserContext(): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(null);
  }

  private mapSeverityToSentryLevel(severity: string): Sentry.SeverityLevel {
    switch (severity) {
      case 'low':
        return 'info';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      case 'critical':
        return 'fatal';
      default:
        return 'warning';
    }
  }
}

// Analytics tracking
export class AnalyticsTracker {
  private static instance: AnalyticsTracker;

  private constructor() {}

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  public trackError(error: Error, context?: ErrorContext): void {
    const errorData = {
      error_type: error.constructor.name,
      error_message: error.message,
      error_stack: error.stack,
      user_id: context?.userId,
      project_id: context?.projectId,
      action: context?.action,
      severity: context?.severity || 'medium',
      timestamp: new Date().toISOString(),
      metadata: context?.metadata,
    };

    // Log for analytics
    logger.info('Error analytics', errorData);

    // Here you could integrate with analytics services like:
    // - Google Analytics
    // - Mixpanel
    // - Amplitude
    // - Custom analytics endpoint
    
    this.sendToAnalytics('error_occurred', errorData);
  }

  public trackPerformance(metric: string, value: number, context?: Record<string, any>): void {
    const performanceData = {
      metric,
      value,
      timestamp: new Date().toISOString(),
      ...context,
    };

    logger.info('Performance metric', performanceData);
    this.sendToAnalytics('performance_metric', performanceData);
  }

  public trackUserAction(action: string, userId?: string, metadata?: Record<string, any>): void {
    const actionData = {
      action,
      user_id: userId,
      timestamp: new Date().toISOString(),
      metadata,
    };

    logger.info('User action', actionData);
    this.sendToAnalytics('user_action', actionData);
  }

  private sendToAnalytics(event: string, data: Record<string, any>): void {
    // In a real implementation, you would send this to your analytics service
    // For now, we'll just log it
    logger.debug(`Analytics event: ${event}`, data);
    
    // Example integration with a hypothetical analytics service:
    // if (process.env.ANALYTICS_ENDPOINT) {
    //   fetch(process.env.ANALYTICS_ENDPOINT, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ event, data })
    //   }).catch(err => logger.error('Analytics send failed', err));
    // }
  }
}

// Export singleton instances
export const errorReporter = ErrorReporter.getInstance();
export const analyticsTracker = AnalyticsTracker.getInstance();