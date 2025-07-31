import logger from './logger';
import { errorReporter, analyticsTracker } from './errorReporting';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: Date;
  context?: Record<string, any>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  context?: Record<string, any>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private timers: Map<string, number> = new Map();
  
  // Default thresholds
  private defaultThresholds: Record<string, { warning: number; critical: number }> = {
    'api_response_time': { warning: 1000, critical: 3000 }, // ms
    'database_query_time': { warning: 500, critical: 2000 }, // ms
    'memory_usage': { warning: 80, critical: 95 }, // percentage
    'cpu_usage': { warning: 70, critical: 90 }, // percentage
    'error_rate': { warning: 5, critical: 10 }, // percentage
    'concurrent_users': { warning: 1000, critical: 2000 }, // count
  };

  private constructor() {
    this.startPeriodicMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  public endTimer(name: string, context?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      context: context || {},
      threshold: this.defaultThresholds[name],
    });

    return duration;
  }

  public recordMetric(metric: PerformanceMetric): void {
    // Store metric
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    
    const metricHistory = this.metrics.get(metric.name)!;
    metricHistory.push(metric);

    // Keep only last 1000 metrics per type
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Log metric
    logger.debug(`Performance metric: ${metric.name} = ${metric.value}${metric.unit}`, {
      metric: metric.name,
      value: metric.value,
      unit: metric.unit,
      context: metric.context,
    });

    // Check thresholds and create alerts
    this.checkThresholds(metric);

    // Send to analytics
    analyticsTracker.trackPerformance(metric.name, metric.value, {
      unit: metric.unit,
      context: metric.context,
    });
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = metric.threshold || this.defaultThresholds[metric.name];
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;

    if (metric.value >= threshold.critical) {
      severity = 'critical';
    } else if (metric.value >= threshold.warning) {
      severity = 'warning';
    }

    if (severity) {
      const alert: PerformanceAlert = {
        metric: metric.name,
        value: metric.value,
        threshold: severity === 'critical' ? threshold.critical : threshold.warning,
        severity,
        timestamp: new Date(),
        context: metric.context || {},
      };

      this.alerts.push(alert);
      this.handleAlert(alert);

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }
    }
  }

  private handleAlert(alert: PerformanceAlert): void {
    const message = `Performance alert: ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`;
    
    logger.warn(message, {
      alert: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
      context: alert.context,
    });

    // Report to error tracking service
    errorReporter.reportMessage(message, 'warning', {
      metadata: {
        alert: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity,
        context: alert.context,
      },
    });

    // Send critical alerts to external monitoring service
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }

  private async sendCriticalAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // In a real implementation, you would send this to your alerting service
      // (e.g., PagerDuty, Slack, email, etc.)
      
      const alertData = {
        service: 'lovable-clone-backend',
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        context: alert.context,
        environment: process.env['NODE_ENV'],
      };

      logger.error('CRITICAL PERFORMANCE ALERT', alertData);

      // Example: Send to webhook
      if (process.env['ALERT_WEBHOOK_URL']) {
        await fetch(process.env['ALERT_WEBHOOK_URL'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData),
        });
      }
    } catch (error) {
      logger.error('Failed to send critical alert', error);
    }
  }

  public getMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name)?.slice(-limit) || [];
    }

    const allMetrics: PerformanceMetric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics.slice(-limit));
    }

    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  public getAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  public getAverageMetric(name: string, timeWindow: number = 300000): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) return null;

    const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / recentMetrics.length;
  }

  private startPeriodicMonitoring(): void {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.recordMetric({
        name: 'memory_heap_used',
        value: memUsage.heapUsed,
        unit: 'bytes',
        timestamp: new Date(),
      });

      this.recordMetric({
        name: 'memory_heap_total',
        value: memUsage.heapTotal,
        unit: 'bytes',
        timestamp: new Date(),
      });

      // CPU usage (approximation using process.cpuUsage())
      const cpuUsage = process.cpuUsage();
      this.recordMetric({
        name: 'cpu_user_time',
        value: cpuUsage.user / 1000, // Convert to ms
        unit: 'ms',
        timestamp: new Date(),
      });

      this.recordMetric({
        name: 'cpu_system_time',
        value: cpuUsage.system / 1000, // Convert to ms
        unit: 'ms',
        timestamp: new Date(),
      });

      // Event loop lag
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordMetric({
          name: 'event_loop_lag',
          value: lag,
          unit: 'ms',
          timestamp: new Date(),
          threshold: { warning: 10, critical: 50 },
        });
      });

    } catch (error) {
      logger.error('Failed to collect system metrics', error);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(name, filteredMetrics);
    }

    // Clean up old alerts
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }

  public setThreshold(metricName: string, warning: number, critical: number): void {
    this.defaultThresholds[metricName] = { warning, critical };
  }

  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, any>;
    recentAlerts: PerformanceAlert[];
  } {
    const recentAlerts = this.getAlerts(10);
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
    const warningAlerts = recentAlerts.filter(a => a.severity === 'warning');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    const metrics: Record<string, any> = {};
    for (const [name, metricList] of this.metrics.entries()) {
      if (metricList.length > 0) {
        const latest = metricList[metricList.length - 1];
        const average = this.getAverageMetric(name);
        if (latest) {
          metrics[name] = {
            latest: latest.value,
            average,
            unit: latest.unit,
            timestamp: latest.timestamp,
          };
        }
      }
    }

    return {
      status,
      metrics,
      recentAlerts,
    };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Middleware for Express to monitor API performance
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const timerName = `api_${req.method}_${req.route?.path || req.path}`;

  performanceMonitor.startTimer(timerName);

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordMetric({
      name: 'api_response_time',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      context: {
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
        userId: req.user?.id,
      },
      threshold: { warning: 1000, critical: 3000 },
    });

    performanceMonitor.endTimer(timerName);
    originalEnd.apply(this, args);
  };

  next();
};