import logger from './logger';
import { performanceMonitor } from './performanceMonitor';
import { errorReporter } from './errorReporting';

export interface DebugInfo {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

export class DebugMode {
  private static instance: DebugMode;
  private isEnabled: boolean = false;
  private debugLogs: DebugInfo[] = [];
  private maxLogs: number = 1000;
  private categories: Set<string> = new Set();
  private enabledCategories: Set<string> = new Set();

  private constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true';
    this.setupDebugCategories();
  }

  public static getInstance(): DebugMode {
    if (!DebugMode.instance) {
      DebugMode.instance = new DebugMode();
    }
    return DebugMode.instance;
  }

  private setupDebugCategories(): void {
    // Default debug categories
    const defaultCategories = [
      'auth',
      'database',
      'api',
      'ai',
      'performance',
      'websocket',
      'file-system',
      'validation',
      'middleware',
      'error-handling',
    ];

    defaultCategories.forEach(category => {
      this.categories.add(category);
      if (this.isEnabled) {
        this.enabledCategories.add(category);
      }
    });

    // Parse DEBUG environment variable (similar to debug npm package)
    const debugEnv = process.env.DEBUG;
    if (debugEnv) {
      const patterns = debugEnv.split(',').map(p => p.trim());
      patterns.forEach(pattern => {
        if (pattern === '*') {
          // Enable all categories
          this.categories.forEach(cat => this.enabledCategories.add(cat));
        } else if (pattern.endsWith('*')) {
          // Enable categories matching prefix
          const prefix = pattern.slice(0, -1);
          this.categories.forEach(cat => {
            if (cat.startsWith(prefix)) {
              this.enabledCategories.add(cat);
            }
          });
        } else {
          // Enable specific category
          this.enabledCategories.add(pattern);
        }
      });
    }
  }

  public enable(categories?: string[]): void {
    this.isEnabled = true;
    
    if (categories) {
      categories.forEach(cat => {
        this.categories.add(cat);
        this.enabledCategories.add(cat);
      });
    } else {
      // Enable all categories
      this.categories.forEach(cat => this.enabledCategories.add(cat));
    }

    logger.info('Debug mode enabled', { categories: Array.from(this.enabledCategories) });
  }

  public disable(): void {
    this.isEnabled = false;
    this.enabledCategories.clear();
    logger.info('Debug mode disabled');
  }

  public enableCategory(category: string): void {
    this.categories.add(category);
    this.enabledCategories.add(category);
    logger.debug(`Debug category enabled: ${category}`);
  }

  public disableCategory(category: string): void {
    this.enabledCategories.delete(category);
    logger.debug(`Debug category disabled: ${category}`);
  }

  public log(category: string, message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const debugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined,
    };

    // Add to debug logs
    this.debugLogs.push(debugInfo);
    
    // Keep only recent logs
    if (this.debugLogs.length > this.maxLogs) {
      this.debugLogs.shift();
    }

    // Log to console/file
    const logMessage = `[DEBUG:${category}] ${message}`;
    switch (level) {
      case 'debug':
        logger.debug(logMessage, data);
        break;
      case 'info':
        logger.info(logMessage, data);
        break;
      case 'warn':
        logger.warn(logMessage, data);
        break;
      case 'error':
        logger.error(logMessage, data);
        break;
    }
  }

  public trace(category: string, message: string, data?: any): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const stack = new Error().stack;
    this.log(category, `TRACE: ${message}`, { ...data, stack }, 'debug');
  }

  public time(category: string, label: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    performanceMonitor.startTimer(`debug_${category}_${label}`);
    this.log(category, `Timer started: ${label}`, undefined, 'debug');
  }

  public timeEnd(category: string, label: string): number {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return 0;
    }

    const duration = performanceMonitor.endTimer(`debug_${category}_${label}`);
    this.log(category, `Timer ended: ${label}`, { duration: `${duration}ms` }, 'debug');
    return duration;
  }

  public dump(category: string, object: any, label?: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    const message = label ? `Object dump: ${label}` : 'Object dump';
    this.log(category, message, {
      type: typeof object,
      constructor: object?.constructor?.name,
      keys: typeof object === 'object' && object !== null ? Object.keys(object) : undefined,
      value: object,
    }, 'debug');
  }

  public assert(category: string, condition: boolean, message: string, data?: any): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    if (!condition) {
      this.log(category, `ASSERTION FAILED: ${message}`, data, 'error');
      
      // Report assertion failure
      errorReporter.reportError(
        new Error(`Debug assertion failed: ${message}`),
        {
          metadata: { category, data },
          severity: 'medium',
        }
      );
    }
  }

  public group(category: string, label: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    this.log(category, `GROUP START: ${label}`, undefined, 'debug');
  }

  public groupEnd(category: string, label: string): void {
    if (!this.isEnabled || !this.enabledCategories.has(category)) {
      return;
    }

    this.log(category, `GROUP END: ${label}`, undefined, 'debug');
  }

  public getLogs(category?: string, limit?: number): DebugInfo[] {
    let logs = this.debugLogs;
    
    if (category) {
      logs = logs.filter(log => log.category === category);
    }
    
    if (limit) {
      logs = logs.slice(-limit);
    }
    
    return logs;
  }

  public getCategories(): string[] {
    return Array.from(this.categories);
  }

  public getEnabledCategories(): string[] {
    return Array.from(this.enabledCategories);
  }

  public clearLogs(): void {
    this.debugLogs = [];
    logger.debug('Debug logs cleared');
  }

  public exportLogs(): string {
    return JSON.stringify(this.debugLogs, null, 2);
  }

  public getSystemInfo(): Record<string, any> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      env: process.env.NODE_ENV,
      debugMode: this.isEnabled,
      enabledCategories: Array.from(this.enabledCategories),
      logCount: this.debugLogs.length,
    };
  }

  public createDebugEndpoint(): any {
    return {
      // GET /debug/info
      getInfo: (req: any, res: any) => {
        if (!this.isEnabled) {
          return res.status(404).json({ error: 'Debug mode not enabled' });
        }

        res.json({
          systemInfo: this.getSystemInfo(),
          performanceHealth: performanceMonitor.getHealthStatus(),
          recentLogs: this.getLogs(undefined, 50),
          categories: this.getCategories(),
          enabledCategories: this.getEnabledCategories(),
        });
      },

      // GET /debug/logs
      getLogs: (req: any, res: any) => {
        if (!this.isEnabled) {
          return res.status(404).json({ error: 'Debug mode not enabled' });
        }

        const { category, limit } = req.query;
        const logs = this.getLogs(category, limit ? parseInt(limit) : undefined);
        
        res.json({ logs });
      },

      // POST /debug/category
      toggleCategory: (req: any, res: any) => {
        if (!this.isEnabled) {
          return res.status(404).json({ error: 'Debug mode not enabled' });
        }

        const { category, enabled } = req.body;
        
        if (enabled) {
          this.enableCategory(category);
        } else {
          this.disableCategory(category);
        }

        res.json({ 
          category, 
          enabled: this.enabledCategories.has(category),
          enabledCategories: Array.from(this.enabledCategories)
        });
      },

      // DELETE /debug/logs
      clearLogs: (req: any, res: any) => {
        if (!this.isEnabled) {
          return res.status(404).json({ error: 'Debug mode not enabled' });
        }

        this.clearLogs();
        res.json({ message: 'Debug logs cleared' });
      },

      // GET /debug/export
      exportLogs: (req: any, res: any) => {
        if (!this.isEnabled) {
          return res.status(404).json({ error: 'Debug mode not enabled' });
        }

        const logs = this.exportLogs();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="debug-logs-${Date.now()}.json"`);
        res.send(logs);
      },
    };
  }
}

// Export singleton instance
export const debugMode = DebugMode.getInstance();

// Convenience functions
export const debug = {
  log: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'debug'),
  info: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'info'),
  warn: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'warn'),
  error: (category: string, message: string, data?: any) => debugMode.log(category, message, data, 'error'),
  trace: (category: string, message: string, data?: any) => debugMode.trace(category, message, data),
  time: (category: string, label: string) => debugMode.time(category, label),
  timeEnd: (category: string, label: string) => debugMode.timeEnd(category, label),
  dump: (category: string, object: any, label?: string) => debugMode.dump(category, object, label),
  assert: (category: string, condition: boolean, message: string, data?: any) => debugMode.assert(category, condition, message, data),
  group: (category: string, label: string) => debugMode.group(category, label),
  groupEnd: (category: string, label: string) => debugMode.groupEnd(category, label),
};