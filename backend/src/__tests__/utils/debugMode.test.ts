import { DebugMode } from '../../utils/debugMode';

describe('DebugMode', () => {
  let debugMode: DebugMode;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    debugMode = new DebugMode();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should return false by default', () => {
      expect(debugMode.isEnabled()).toBe(false);
    });

    it('should return true when enabled', () => {
      debugMode.enable();
      expect(debugMode.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      debugMode.enable();
      debugMode.disable();
      expect(debugMode.isEnabled()).toBe(false);
    });
  });

  describe('enable', () => {
    it('should enable debug mode', () => {
      debugMode.enable();
      expect(debugMode.isEnabled()).toBe(true);
    });

    it('should log enable message', () => {
      debugMode.enable();
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Debug mode enabled');
    });
  });

  describe('disable', () => {
    it('should disable debug mode', () => {
      debugMode.enable();
      debugMode.disable();
      expect(debugMode.isEnabled()).toBe(false);
    });

    it('should log disable message', () => {
      debugMode.enable();
      consoleSpy.mockClear();
      
      debugMode.disable();
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Debug mode disabled');
    });
  });

  describe('log', () => {
    it('should log message when debug mode is enabled', () => {
      debugMode.enable();
      debugMode.log('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Test message');
    });

    it('should not log message when debug mode is disabled', () => {
      debugMode.log('Test message');

      expect(consoleSpy).not.toHaveBeenCalledWith('[DEBUG] Test message');
    });

    it('should log message with additional data', () => {
      debugMode.enable();
      const data = { userId: '123', action: 'login' };
      debugMode.log('User action', data);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] User action', data);
    });
  });

  describe('logError', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log error when debug mode is enabled', () => {
      debugMode.enable();
      const error = new Error('Test error');
      debugMode.logError('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG ERROR] Error occurred', error);
    });

    it('should not log error when debug mode is disabled', () => {
      const error = new Error('Test error');
      debugMode.logError('Error occurred', error);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('logPerformance', () => {
    it('should log performance data when debug mode is enabled', () => {
      debugMode.enable();
      const performanceData = {
        operation: 'database_query',
        duration: 150,
        memory: 1024,
      };
      debugMode.logPerformance('Query completed', performanceData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG PERF] Query completed',
        performanceData
      );
    });

    it('should not log performance data when debug mode is disabled', () => {
      const performanceData = {
        operation: 'database_query',
        duration: 150,
        memory: 1024,
      };
      debugMode.logPerformance('Query completed', performanceData);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('trace', () => {
    it('should log trace information when debug mode is enabled', () => {
      debugMode.enable();
      debugMode.trace('Function entry', 'myFunction', { param1: 'value1' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG TRACE] Function entry - myFunction',
        { param1: 'value1' }
      );
    });

    it('should not log trace information when debug mode is disabled', () => {
      debugMode.trace('Function entry', 'myFunction', { param1: 'value1' });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('dump', () => {
    it('should dump object data when debug mode is enabled', () => {
      debugMode.enable();
      const data = {
        user: { id: '123', name: 'John' },
        request: { method: 'GET', url: '/api/users' },
      };
      debugMode.dump('Request data', data);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG DUMP] Request data',
        JSON.stringify(data, null, 2)
      );
    });

    it('should not dump object data when debug mode is disabled', () => {
      const data = { test: 'value' };
      debugMode.dump('Test data', data);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should handle circular references in objects', () => {
      debugMode.enable();
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      debugMode.dump('Circular object', obj);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG DUMP] Circular object',
        expect.stringContaining('[Circular]')
      );
    });
  });

  describe('time', () => {
    it('should start timing operation when debug mode is enabled', () => {
      debugMode.enable();
      debugMode.time('test-operation');

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG TIME] Started: test-operation');
    });

    it('should not start timing when debug mode is disabled', () => {
      debugMode.time('test-operation');

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('timeEnd', () => {
    it('should end timing operation when debug mode is enabled', () => {
      debugMode.enable();
      debugMode.time('test-operation');
      consoleSpy.mockClear();

      // Wait a bit to ensure measurable time
      setTimeout(() => {
        debugMode.timeEnd('test-operation');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[DEBUG TIME\] Completed: test-operation - \d+ms/)
        );
      }, 10);
    });

    it('should not end timing when debug mode is disabled', () => {
      debugMode.timeEnd('test-operation');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should handle ending non-existent timer', () => {
      debugMode.enable();
      debugMode.timeEnd('non-existent-operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG TIME] Timer not found: non-existent-operation'
      );
    });
  });

  describe('environment detection', () => {
    it('should auto-enable in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devDebugMode = new DebugMode();
      expect(devDebugMode.isEnabled()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not auto-enable in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodDebugMode = new DebugMode();
      expect(prodDebugMode.isEnabled()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });
});