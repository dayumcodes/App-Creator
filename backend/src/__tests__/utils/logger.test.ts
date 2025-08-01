import { logger, createLogger } from '../../utils/logger';
import winston from 'winston';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    DailyRotateFile: jest.fn(),
  },
}));

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      silly: jest.fn(),
    };
    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create logger with correct configuration', () => {
      const testLogger = createLogger();

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: expect.any(String),
        format: expect.anything(),
        transports: expect.any(Array),
        exitOnError: false,
      });
    });

    it('should use development configuration in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      const testLogger = createLogger();

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should use production configuration in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const testLogger = createLogger();

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        })
      );
    });
  });

  describe('logger instance', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const meta = { userId: '123' };

      logger.info(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should log error messages', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(message, error);

      expect(mockLogger.error).toHaveBeenCalledWith(message, error);
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(mockLogger.warn).toHaveBeenCalledWith(message);
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const debugData = { requestId: 'req-123' };

      logger.debug(message, debugData);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, debugData);
    });
  });

  describe('error logging with stack traces', () => {
    it('should log errors with stack traces', () => {
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Error occurred', { error });

      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
        error: expect.objectContaining({
          message: 'Test error with stack',
          stack: expect.stringContaining('Error: Test error'),
        }),
      });
    });
  });

  describe('structured logging', () => {
    it('should support structured logging with metadata', () => {
      const metadata = {
        userId: 'user-123',
        action: 'login',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      logger.info('User login attempt', metadata);

      expect(mockLogger.info).toHaveBeenCalledWith('User login attempt', metadata);
    });

    it('should support correlation IDs', () => {
      const correlationId = 'corr-123';
      const message = 'Processing request';

      logger.info(message, { correlationId });

      expect(mockLogger.info).toHaveBeenCalledWith(message, { correlationId });
    });
  });

  describe('performance logging', () => {
    it('should log performance metrics', () => {
      const performanceData = {
        operation: 'database_query',
        duration: 150,
        query: 'SELECT * FROM users',
      };

      logger.info('Database query completed', performanceData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database query completed',
        performanceData
      );
    });
  });

  describe('security logging', () => {
    it('should log security events', () => {
      const securityEvent = {
        event: 'failed_login',
        userId: 'user-123',
        ip: '192.168.1.1',
        attempts: 3,
      };

      logger.warn('Security event detected', securityEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        securityEvent
      );
    });

    it('should log authentication events', () => {
      const authEvent = {
        event: 'token_expired',
        userId: 'user-123',
        tokenId: 'token-456',
      };

      logger.info('Authentication event', authEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Authentication event', authEvent);
    });
  });
});