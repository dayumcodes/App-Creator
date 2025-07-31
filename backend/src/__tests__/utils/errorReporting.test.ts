import { ErrorReporter, errorReporter, analyticsTracker } from '../../utils/errorReporting';

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((callback) => callback({ setLevel: jest.fn() })),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

import * as Sentry from '@sentry/node';
import logger from '../../utils/logger';

describe('ErrorReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize Sentry when DSN is provided', () => {
      const originalDsn = process.env['SENTRY_DSN'];
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      
      const reporter = ErrorReporter.getInstance();
      reporter.initialize();
      
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: process.env['NODE_ENV'] || 'development',
        })
      );
      
      process.env['SENTRY_DSN'] = originalDsn;
    });

    it('should warn when DSN is not configured', () => {
      const originalDsn = process.env['SENTRY_DSN'];
      process.env['SENTRY_DSN'] = '';
      
      // Create a new instance to test initialization
      const reporter = new (ErrorReporter as any)();
      reporter.initialize();
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Sentry DSN not configured. Error reporting will use local logging only.'
      );
      
      process.env['SENTRY_DSN'] = originalDsn;
    });
  });

  describe('Error Reporting', () => {
    beforeEach(() => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      errorReporter.initialize();
    });

    it('should report error with context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        projectId: 'project456',
        action: 'test_action',
        severity: 'high' as const,
        metadata: { key: 'value' }
      };

      errorReporter.reportError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Error reported',
        expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String),
          context,
          timestamp: expect.any(String),
        })
      );

      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user123' });
      expect(Sentry.setContext).toHaveBeenCalledWith('error_context', {
        projectId: 'project456',
        action: 'test_action',
        severity: 'high',
        metadata: { key: 'value' }
      });
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should report error without context', () => {
      const error = new Error('Test error');

      errorReporter.reportError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Error reported',
        expect.objectContaining({
          message: 'Test error',
          context: undefined,
        })
      );

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should map severity levels correctly', () => {
      const error = new Error('Test error');
      const mockScope = { setLevel: jest.fn() };
      
      (Sentry.withScope as jest.Mock).mockImplementation((callback) => callback(mockScope));

      // Test different severity levels
      const severityMappings = [
        { input: 'low', expected: 'info' },
        { input: 'medium', expected: 'warning' },
        { input: 'high', expected: 'error' },
        { input: 'critical', expected: 'fatal' },
      ];

      severityMappings.forEach(({ input, expected }) => {
        errorReporter.reportError(error, { severity: input as any });
        expect(mockScope.setLevel).toHaveBeenCalledWith(expected);
        jest.clearAllMocks();
      });
    });
  });

  describe('Message Reporting', () => {
    beforeEach(() => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      errorReporter.initialize();
    });

    it('should report info message', () => {
      const context = { userId: 'user123' };

      errorReporter.reportMessage('Test message', 'info', context);

      expect(logger.info).toHaveBeenCalledWith('Test message', { context });
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
    });

    it('should report warning message', () => {
      errorReporter.reportMessage('Warning message', 'warning');

      expect(logger.warn).toHaveBeenCalledWith('Warning message', { context: undefined });
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
    });

    it('should report error message', () => {
      errorReporter.reportMessage('Error message', 'error');

      expect(logger.error).toHaveBeenCalledWith('Error message', { context: undefined });
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Error message', 'error');
    });
  });

  describe('Breadcrumbs', () => {
    beforeEach(() => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      errorReporter.initialize();
    });

    it('should add breadcrumb', () => {
      const data = { key: 'value' };

      errorReporter.addBreadcrumb('Test breadcrumb', 'test', data);

      expect(logger.debug).toHaveBeenCalledWith('Breadcrumb: test - Test breadcrumb', data);
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test breadcrumb',
        category: 'test',
        data,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('User Context', () => {
    beforeEach(() => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      errorReporter.initialize();
    });

    it('should set user context', () => {
      errorReporter.setUserContext('user123', 'test@example.com', 'testuser');

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should clear user context', () => {
      errorReporter.clearUserContext();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });
});

describe('AnalyticsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Tracking', () => {
    it('should track error with context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        projectId: 'project456',
        action: 'test_action',
        severity: 'high' as const,
        metadata: { key: 'value' }
      };

      analyticsTracker.trackError(error, context);

      expect(logger.info).toHaveBeenCalledWith(
        'Error analytics',
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Test error',
          error_stack: expect.any(String),
          user_id: 'user123',
          project_id: 'project456',
          action: 'test_action',
          severity: 'high',
          timestamp: expect.any(String),
          metadata: { key: 'value' }
        })
      );
    });

    it('should track error without context', () => {
      const error = new Error('Test error');

      analyticsTracker.trackError(error);

      expect(logger.info).toHaveBeenCalledWith(
        'Error analytics',
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Test error',
          user_id: undefined,
          project_id: undefined,
          action: undefined,
          severity: 'medium',
          metadata: undefined
        })
      );
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metric', () => {
      const context = { component: 'test' };

      analyticsTracker.trackPerformance('response_time', 150, context);

      expect(logger.info).toHaveBeenCalledWith(
        'Performance metric',
        expect.objectContaining({
          metric: 'response_time',
          value: 150,
          timestamp: expect.any(String),
          component: 'test'
        })
      );
    });
  });

  describe('User Action Tracking', () => {
    it('should track user action with metadata', () => {
      const metadata = { button: 'save', page: 'editor' };

      analyticsTracker.trackUserAction('button_click', 'user123', metadata);

      expect(logger.info).toHaveBeenCalledWith(
        'User action',
        expect.objectContaining({
          action: 'button_click',
          user_id: 'user123',
          timestamp: expect.any(String),
          metadata
        })
      );
    });

    it('should track user action without metadata', () => {
      analyticsTracker.trackUserAction('page_view');

      expect(logger.info).toHaveBeenCalledWith(
        'User action',
        expect.objectContaining({
          action: 'page_view',
          user_id: undefined,
          metadata: undefined
        })
      );
    });
  });
});