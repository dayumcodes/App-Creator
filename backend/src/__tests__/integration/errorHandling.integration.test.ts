import request from 'supertest';
import express from 'express';
import { errorHandler, CustomError, ValidationError } from '../../middleware/errorHandler';
import { errorReporter } from '../../utils/errorReporting';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { debugMode } from '../../utils/debugMode';

// Mock logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('Error Handling Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    // Initialize error reporting
    errorReporter.initialize();
    
    // Enable debug mode for testing
    debugMode.enable(['error-handling', 'api']);
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Test routes
    app.get('/test/success', (_req, res) => {
      res.json({ message: 'Success' });
    });

    app.get('/test/validation-error', (_req, _res, next) => {
      next(new ValidationError('Invalid input', { field: 'email' }));
    });

    app.get('/test/custom-error', (_req, _res, next) => {
      next(new CustomError('Custom error message', 400, 'CUSTOM_ERROR'));
    });

    app.get('/test/generic-error', (_req, _res, next) => {
      next(new Error('Generic error'));
    });

    app.get('/test/async-error', async (_req, _res, next) => {
      try {
        throw new Error('Async error');
      } catch (error) {
        next(error);
      }
    });

    // Performance monitoring middleware
    app.use((req: any, res: any, next: any) => {
      const startTime = Date.now();
      performanceMonitor.startTimer(`api_${req.method}_${req.path}`);
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        performanceMonitor.recordMetric({
          name: 'api_response_time',
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
          context: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
          },
        });
        performanceMonitor.endTimer(`api_${req.method}_${req.path}`);
      });
      
      next();
    });

    // Error handling middleware
    app.use(errorHandler);
  });

  describe('Successful Requests', () => {
    it('should handle successful requests', async () => {
      const response = await request(app)
        .get('/test/success')
        .expect(200);

      expect(response.body).toEqual({ message: 'Success' });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors correctly', async () => {
      const response = await request(app)
        .get('/test/validation-error')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          suggestions: expect.arrayContaining([
            'Please check your input data and try again',
            'Ensure all required fields are filled',
            'Verify that data formats are correct'
          ])
        }
      });
    });

    it('should handle custom errors correctly', async () => {
      const response = await request(app)
        .get('/test/custom-error')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'CUSTOM_ERROR',
          message: 'Custom error message',
          suggestions: expect.arrayContaining([
            'Please try again later',
            'Refresh the page',
            'Contact support if the problem persists'
          ])
        }
      });
    });

    it('should handle generic errors correctly', async () => {
      const response = await request(app)
        .get('/test/generic-error')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Generic error',
          suggestions: expect.arrayContaining([
            'Please try again later',
            'Refresh the page',
            'Contact support if the problem persists'
          ])
        }
      });
    });

    it('should handle async errors correctly', async () => {
      const response = await request(app)
        .get('/test/async-error')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Async error',
          suggestions: expect.any(Array)
        }
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should record performance metrics for requests', async () => {
      const initialMetrics = performanceMonitor.getMetrics('api_response_time');
      
      await request(app)
        .get('/test/success')
        .expect(200);

      const finalMetrics = performanceMonitor.getMetrics('api_response_time');
      expect(finalMetrics.length).toBeGreaterThan(initialMetrics.length);
      
      const latestMetric = finalMetrics[finalMetrics.length - 1];
      expect(latestMetric?.name).toBe('api_response_time');
      expect(latestMetric?.value).toBeGreaterThan(0);
      expect(latestMetric?.unit).toBe('ms');
    });

    it('should record performance metrics for error requests', async () => {
      const initialMetrics = performanceMonitor.getMetrics('api_response_time');
      
      await request(app)
        .get('/test/validation-error')
        .expect(400);

      const finalMetrics = performanceMonitor.getMetrics('api_response_time');
      expect(finalMetrics.length).toBeGreaterThan(initialMetrics.length);
      
      const latestMetric = finalMetrics[finalMetrics.length - 1];
      expect(latestMetric?.context?.['statusCode']).toBe(400);
    });
  });

  describe('Debug Mode', () => {
    it('should log debug information when enabled', async () => {
      debugMode.log('error-handling', 'Test debug message', { test: true });
      
      const logs = debugMode.getLogs('error-handling');
      expect(logs.length).toBeGreaterThan(0);
      
      const latestLog = logs[logs.length - 1];
      expect(latestLog?.category).toBe('error-handling');
      expect(latestLog?.message).toBe('Test debug message');
      expect(latestLog?.data).toEqual({ test: true });
    });

    it('should provide system information', () => {
      const systemInfo = debugMode.getSystemInfo();
      
      expect(systemInfo).toHaveProperty('nodeVersion');
      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('memoryUsage');
      expect(systemInfo).toHaveProperty('debugMode');
      expect(systemInfo['debugMode']).toBe(true);
    });
  });

  describe('Error Recovery Suggestions', () => {
    it('should provide appropriate recovery suggestions for different error types', async () => {
      // Test validation error suggestions
      const validationResponse = await request(app)
        .get('/test/validation-error')
        .expect(400);

      expect(validationResponse.body.error.suggestions).toContain(
        'Please check your input data and try again'
      );

      // Test generic error suggestions
      const genericResponse = await request(app)
        .get('/test/generic-error')
        .expect(500);

      expect(genericResponse.body.error.suggestions).toContain(
        'Please try again later'
      );
    });
  });

  describe('Health Check', () => {
    it('should provide performance health status', () => {
      const healthStatus = performanceMonitor.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('metrics');
      expect(healthStatus).toHaveProperty('recentAlerts');
      expect(['healthy', 'warning', 'critical']).toContain(healthStatus.status);
    });
  });
});