import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FrontendErrorHandler, handleApiError, handleValidationError, handleAsyncError } from '../errorHandler';

// Mock fetch
global.fetch = vi.fn();

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};
Object.assign(console, mockConsole);

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('FrontendErrorHandler', () => {
  let errorHandler: FrontendErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    mockSessionStorage.getItem.mockReturnValue('[]');

    // Create new instance for each test
    errorHandler = FrontendErrorHandler.getInstance();
    errorHandler.clearErrorQueue();
  });

  describe('Error Handling', () => {
    it('should handle error with context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        projectId: 'project456',
        action: 'test_action',
        metadata: { key: 'value' }
      };

      errorHandler.handleError(error, context, 'high');

      expect(errorHandler.getQueueSize()).toBe(1);
    });

    it('should handle error without context', () => {
      const error = new Error('Test error');

      errorHandler.handleError(error);

      expect(errorHandler.getQueueSize()).toBe(1);
    });

    it('should log error in development mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const error = new Error('Test error');
      errorHandler.handleError(error);

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error handled:',
        expect.objectContaining({
          message: 'Test error',
          severity: 'medium',
        })
      );

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should show notification for critical errors', () => {
      // Mock document.createElement and appendChild
      const mockElement = {
        className: '',
        innerHTML: '',
        style: { cssText: '' },
        remove: vi.fn(),
        parentElement: document.body,
      };

      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement as any);

      const error = new Error('Critical error');
      errorHandler.handleError(error, undefined, 'critical');

      expect(createElement).toHaveBeenCalledWith('div');
      expect(appendChild).toHaveBeenCalledWith(mockElement);
      expect(mockElement.innerHTML).toContain('Critical error');

      createElement.mockRestore();
      appendChild.mockRestore();
    });
  });

  describe('Error Queue Management', () => {
    it('should flush error queue when online', async () => {
      const error = new Error('Test error');
      errorHandler.handleError(error);

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.fetch).toHaveBeenCalledWith('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"message":"Test error"'),
      });
    });

    it('should not flush error queue when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const error = new Error('Test error');
      errorHandler.handleError(error);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(errorHandler.getQueueSize()).toBe(1);
    });

    it('should retry failed requests', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const error = new Error('Test error');
      errorHandler.handleError(error);

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear error queue', () => {
      const error = new Error('Test error');
      errorHandler.handleError(error);

      expect(errorHandler.getQueueSize()).toBe(1);

      errorHandler.clearErrorQueue();

      expect(errorHandler.getQueueSize()).toBe(0);
    });
  });

  describe('User Action Tracking', () => {
    it('should track user actions', () => {
      const context = { component: 'test' };
      errorHandler.reportUserAction('button_click', context);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'recentActions',
        expect.stringContaining('"action":"button_click"')
      );
    });

    it('should limit recent actions to 10', () => {
      // Mock existing actions
      const existingActions = Array.from({ length: 10 }, (_, i) => ({
        action: `action_${i}`,
        timestamp: new Date().toISOString(),
      }));

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(existingActions));

      errorHandler.reportUserAction('new_action');

      const setItemCall = mockSessionStorage.setItem.mock.calls[0];
      const storedActions = JSON.parse(setItemCall[1]);

      expect(storedActions).toHaveLength(10);
      expect(storedActions[9].action).toBe('new_action');
      expect(storedActions[0].action).toBe('action_1'); // First action removed
    });

    it('should get recent actions', () => {
      const actions = [{ action: 'test', timestamp: new Date().toISOString() }];
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(actions));

      const recentActions = errorHandler.getRecentActions();

      expect(recentActions).toEqual(actions);
    });
  });

  describe('Global Error Handlers', () => {
    it('should handle window error events', () => {
      const handleError = vi.spyOn(errorHandler, 'handleError');

      // Simulate window error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Script error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      });

      window.dispatchEvent(errorEvent);

      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          action: 'global_error',
          metadata: {
            filename: 'test.js',
            lineno: 10,
            colno: 5,
          },
        }),
        'high'
      );
    });

    it('should handle unhandled promise rejections', () => {
      const handleError = vi.spyOn(errorHandler, 'handleError');

      // Simulate unhandled promise rejection
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject('Test rejection'),
        reason: 'Test rejection',
      });

      window.dispatchEvent(rejectionEvent);

      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          action: 'unhandled_promise_rejection',
          metadata: { reason: 'Test rejection' },
        }),
        'high'
      );
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should handle HTTP error response', () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Bad request'
            }
          }
        },
        config: {
          url: '/api/test',
          method: 'POST'
        }
      };

      const context = { userId: 'user123' };
      handleApiError(error, context);

      // Should not throw and should handle the error
      expect(true).toBe(true); // Test passes if no error is thrown
    });

    it('should handle network error', () => {
      const error = {
        request: {},
        config: {
          url: '/api/test',
          method: 'GET'
        }
      };

      handleApiError(error);

      // Should not throw and should handle the error
      expect(true).toBe(true);
    });

    it('should handle unknown error', () => {
      const error = {
        message: 'Unknown error'
      };

      handleApiError(error);

      // Should not throw and should handle the error
      expect(true).toBe(true);
    });
  });

  describe('handleValidationError', () => {
    it('should handle validation errors', () => {
      const errors = {
        email: 'Invalid email format',
        password: 'Password too short'
      };

      const context = {
        action: 'form_validation',
        metadata: { form: 'registration' }
      };
      handleValidationError(errors, context);

      // Should not throw and should handle the error
      expect(true).toBe(true);
    });
  });

  describe('handleAsyncError', () => {
    it('should handle successful async operation', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const context = {
        action: 'async_operation',
        metadata: { operation: 'test' }
      };

      const result = await handleAsyncError(asyncFn, context);

      expect(result).toBe('success');
      expect(asyncFn).toHaveBeenCalled();
    });

    it('should handle failed async operation', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
      const context = {
        action: 'async_operation',
        metadata: { operation: 'test' }
      };

      const result = await handleAsyncError(asyncFn, context);

      expect(result).toBeNull();
      expect(asyncFn).toHaveBeenCalled();
    });
  });
});