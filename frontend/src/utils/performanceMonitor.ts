import { errorHandler } from './errorHandler';

export interface WebVital {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface PerformanceEntry {
  name: string;
  type: string;
  startTime: number;
  duration: number;
  timestamp: number;
}

export class FrontendPerformanceMonitor {
  private static instance: FrontendPerformanceMonitor;
  private webVitals: WebVital[] = [];
  private performanceEntries: PerformanceEntry[] = [];
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.initializeWebVitals();
    this.initializePerformanceObservers();
    this.startPeriodicReporting();
  }

  public static getInstance(): FrontendPerformanceMonitor {
    if (!FrontendPerformanceMonitor.instance) {
      FrontendPerformanceMonitor.instance = new FrontendPerformanceMonitor();
    }
    return FrontendPerformanceMonitor.instance;
  }

  private initializeWebVitals(): void {
    // Largest Contentful Paint (LCP)
    this.observeWebVital('largest-contentful-paint', (entry: any) => {
      this.recordWebVital('LCP', entry.startTime, this.getLCPRating(entry.startTime));
    });

    // First Input Delay (FID)
    this.observeWebVital('first-input', (entry: any) => {
      this.recordWebVital('FID', entry.processingStart - entry.startTime, this.getFIDRating(entry.processingStart - entry.startTime));
    });

    // Cumulative Layout Shift (CLS)
    this.observeWebVital('layout-shift', (entry: any) => {
      if (!entry.hadRecentInput) {
        this.recordWebVital('CLS', entry.value, this.getCLSRating(entry.value));
      }
    });

    // First Contentful Paint (FCP)
    this.observeWebVital('paint', (entry: any) => {
      if (entry.name === 'first-contentful-paint') {
        this.recordWebVital('FCP', entry.startTime, this.getFCPRating(entry.startTime));
      }
    });

    // Time to First Byte (TTFB)
    this.observeWebVital('navigation', (entry: any) => {
      this.recordWebVital('TTFB', entry.responseStart - entry.requestStart, this.getTTFBRating(entry.responseStart - entry.requestStart));
    });
  }

  private observeWebVital(type: string, callback: (entry: any) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  private initializePerformanceObservers(): void {
    // Resource loading performance
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordPerformanceEntry({
            name: entry.name,
            type: 'resource',
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now(),
          });

          // Alert on slow resources
          if (entry.duration > 3000) {
            errorHandler.handleError(
              new Error(`Slow resource loading: ${entry.name}`),
              {
                action: 'slow_resource',
                metadata: {
                  resource: entry.name,
                  duration: entry.duration,
                  type: (entry as any).initiatorType,
                },
              },
              'medium'
            );
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      console.warn('Failed to observe resource performance:', error);
    }

    // Long task performance
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordPerformanceEntry({
            name: 'long-task',
            type: 'longtask',
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now(),
          });

          // Alert on long tasks
          errorHandler.handleError(
            new Error(`Long task detected: ${entry.duration}ms`),
            {
              action: 'long_task',
              metadata: {
                duration: entry.duration,
                startTime: entry.startTime,
              },
            },
            entry.duration > 100 ? 'high' : 'medium'
          );
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (error) {
      console.warn('Failed to observe long tasks:', error);
    }
  }

  private recordWebVital(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor'): void {
    const vital: WebVital = {
      name,
      value,
      rating,
      timestamp: Date.now(),
    };

    this.webVitals.push(vital);

    // Keep only last 100 vitals
    if (this.webVitals.length > 100) {
      this.webVitals.shift();
    }

    console.log(`Web Vital - ${name}: ${value}ms (${rating})`);

    // Report poor vitals as errors
    if (rating === 'poor') {
      errorHandler.handleError(
        new Error(`Poor web vital: ${name} = ${value}ms`),
        {
          action: 'poor_web_vital',
          metadata: { vital: name, value, rating },
        },
        'medium'
      );
    }
  }

  private recordPerformanceEntry(entry: PerformanceEntry): void {
    this.performanceEntries.push(entry);

    // Keep only last 500 entries
    if (this.performanceEntries.length > 500) {
      this.performanceEntries.shift();
    }
  }

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private getFCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private getTTFBRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 800) return 'good';
    if (value <= 1800) return 'needs-improvement';
    return 'poor';
  }

  public measureUserTiming(name: string, startMark?: string, endMark?: string): void {
    try {
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name);
      }
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
    }
  }

  public mark(name: string): void {
    try {
      performance.mark(name);
    } catch (error) {
      console.warn(`Failed to mark ${name}:`, error);
    }
  }

  public getWebVitals(): WebVital[] {
    return [...this.webVitals];
  }

  public getPerformanceEntries(): PerformanceEntry[] {
    return [...this.performanceEntries];
  }

  public getPerformanceSummary(): {
    webVitals: Record<string, WebVital | undefined>;
    resourceCount: number;
    longTaskCount: number;
    averageResourceLoadTime: number;
  } {
    const latestVitals: Record<string, WebVital | undefined> = {};
    
    // Get latest vital for each type
    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(vitalName => {
      const vitals = this.webVitals.filter(v => v.name === vitalName);
      latestVitals[vitalName] = vitals.length > 0 ? vitals[vitals.length - 1] : undefined;
    });

    const resourceEntries = this.performanceEntries.filter(e => e.type === 'resource');
    const longTaskEntries = this.performanceEntries.filter(e => e.type === 'longtask');
    
    const averageResourceLoadTime = resourceEntries.length > 0
      ? resourceEntries.reduce((sum, entry) => sum + entry.duration, 0) / resourceEntries.length
      : 0;

    return {
      webVitals: latestVitals,
      resourceCount: resourceEntries.length,
      longTaskCount: longTaskEntries.length,
      averageResourceLoadTime,
    };
  }

  private startPeriodicReporting(): void {
    // Report performance data every 30 seconds
    setInterval(() => {
      this.reportPerformanceData();
    }, 30000);

    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.reportPerformanceData();
    });

    // Report on visibility change (when user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reportPerformanceData();
      }
    });
  }

  private async reportPerformanceData(): Promise<void> {
    try {
      const summary = this.getPerformanceSummary();
      
      await fetch('/api/performance/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webVitals: this.webVitals.slice(-10), // Last 10 vitals
          performanceEntries: this.performanceEntries.slice(-50), // Last 50 entries
          summary,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.warn('Failed to report performance data:', error);
    }
  }

  public disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Export singleton instance
export const performanceMonitor = FrontendPerformanceMonitor.getInstance();

// Utility functions for common performance measurements
export const measureAsync = async <T>(
  name: string,
  asyncFn: () => Promise<T>
): Promise<T> => {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  
  performanceMonitor.mark(startMark);
  
  try {
    const result = await asyncFn();
    performanceMonitor.mark(endMark);
    performanceMonitor.measureUserTiming(name, startMark, endMark);
    return result;
  } catch (error) {
    performanceMonitor.mark(endMark);
    performanceMonitor.measureUserTiming(name, startMark, endMark);
    throw error;
  }
};

export const measureSync = <T>(name: string, syncFn: () => T): T => {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  
  performanceMonitor.mark(startMark);
  
  try {
    const result = syncFn();
    performanceMonitor.mark(endMark);
    performanceMonitor.measureUserTiming(name, startMark, endMark);
    return result;
  } catch (error) {
    performanceMonitor.mark(endMark);
    performanceMonitor.measureUserTiming(name, startMark, endMark);
    throw error;
  }
};