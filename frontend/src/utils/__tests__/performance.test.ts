import { performanceMonitor } from '../performanceMonitor';

// Mock Web APIs for testing
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

const mockNavigator = {
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50
  }
};

// Setup global mocks
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});

describe('Frontend Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Performance Monitoring', () => {
    test('should track component render times', () => {
      const componentName = 'TestComponent';
      
      performanceMonitor.mark(`${componentName}-render-start`);
      
      // Simulate component rendering time
      const renderTime = 50;
      mockPerformance.now.mockReturnValueOnce(Date.now() + renderTime);
      
      performanceMonitor.mark(`${componentName}-render-end`);
      performanceMonitor.measure(`${componentName}-render`, `${componentName}-render-start`, `${componentName}-render-end`);
      
      expect(mockPerformance.mark).toHaveBeenCalledWith(`${componentName}-render-start`);
      expect(mockPerformance.mark).toHaveBeenCalledWith(`${componentName}-render-end`);
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        `${componentName}-render`,
        `${componentName}-render-start`,
        `${componentName}-render-end`
      );
    });

    test('should track API request performance', async () => {
      const apiEndpoint = '/api/projects';
      const startTime = Date.now();
      
      performanceMonitor.startTimer(`api-request-${apiEndpoint}`);
      
      // Simulate API request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = Date.now();
      const duration = performanceMonitor.endTimer(`api-request-${apiEndpoint}`);
      
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(150);
    });

    test('should collect Web Vitals metrics', () => {
      const webVitals = [
        { name: 'FCP', value: 1200, rating: 'good' },
        { name: 'LCP', value: 2100, rating: 'good' },
        { name: 'FID', value: 80, rating: 'good' },
        { name: 'CLS', value: 0.05, rating: 'good' }
      ];

      webVitals.forEach(vital => {
        performanceMonitor.recordWebVital(vital.name, vital.value, vital.rating);
      });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.webVitals).toHaveLength(4);
      
      const fcpMetric = metrics.webVitals.find(m => m.name === 'FCP');
      expect(fcpMetric).toBeDefined();
      expect(fcpMetric?.value).toBe(1200);
      expect(fcpMetric?.rating).toBe('good');
    });
  });

  describe('Performance Optimization Tests', () => {
    test('should detect slow component renders', () => {
      const slowRenderThreshold = 16; // 16ms for 60fps
      const componentName = 'SlowComponent';
      
      performanceMonitor.mark(`${componentName}-render-start`);
      
      // Simulate slow render (>16ms)
      const slowRenderTime = 50;
      mockPerformance.now.mockReturnValueOnce(Date.now() + slowRenderTime);
      
      performanceMonitor.mark(`${componentName}-render-end`);
      
      const renderDuration = performanceMonitor.measureRenderTime(componentName);
      
      expect(renderDuration).toBeGreaterThan(slowRenderThreshold);
      
      // Should trigger performance warning
      const warnings = performanceMonitor.getWarnings();
      expect(warnings).toContain(`Slow render detected: ${componentName} took ${renderDuration}ms`);
    });

    test('should track memory usage patterns', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Simulate memory-intensive operations
      const largeArray = new Array(100000).fill('test-data');
      
      const currentMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = currentMemory - initialMemory;
      
      performanceMonitor.recordMemoryUsage(currentMemory);
      
      const memoryMetrics = performanceMonitor.getMemoryMetrics();
      expect(memoryMetrics.current).toBe(currentMemory);
      
      // Cleanup
      largeArray.length = 0;
    });

    test('should identify performance bottlenecks', () => {
      const operations = [
        { name: 'database-query', duration: 150 },
        { name: 'api-request', duration: 300 },
        { name: 'component-render', duration: 25 },
        { name: 'image-processing', duration: 800 }
      ];

      operations.forEach(op => {
        performanceMonitor.recordOperation(op.name, op.duration);
      });

      const bottlenecks = performanceMonitor.identifyBottlenecks();
      
      expect(bottlenecks).toContain('image-processing'); // Slowest operation
      expect(bottlenecks).toContain('api-request'); // Second slowest
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    test('should track bundle loading times', () => {
      const bundles = [
        { name: 'main', size: 250000, loadTime: 120 },
        { name: 'vendor', size: 800000, loadTime: 350 },
        { name: 'monaco-editor', size: 1200000, loadTime: 500 }
      ];

      bundles.forEach(bundle => {
        performanceMonitor.recordBundleLoad(bundle.name, bundle.size, bundle.loadTime);
      });

      const bundleMetrics = performanceMonitor.getBundleMetrics();
      
      expect(bundleMetrics).toHaveLength(3);
      expect(bundleMetrics.find(b => b.name === 'monaco-editor')?.loadTime).toBe(500);
      
      // Check for large bundles
      const largeBundles = bundleMetrics.filter(b => b.size > 1000000);
      expect(largeBundles).toHaveLength(1);
      expect(largeBundles[0].name).toBe('monaco-editor');
    });

    test('should measure code splitting effectiveness', () => {
      const routes = [
        { path: '/dashboard', chunkSize: 150000, loadTime: 80 },
        { path: '/editor', chunkSize: 300000, loadTime: 150 },
        { path: '/profile', chunkSize: 50000, loadTime: 30 }
      ];

      routes.forEach(route => {
        performanceMonitor.recordRouteLoad(route.path, route.chunkSize, route.loadTime);
      });

      const routeMetrics = performanceMonitor.getRouteMetrics();
      const avgChunkSize = routeMetrics.reduce((sum, r) => sum + r.chunkSize, 0) / routeMetrics.length;
      const avgLoadTime = routeMetrics.reduce((sum, r) => sum + r.loadTime, 0) / routeMetrics.length;

      expect(avgChunkSize).toBeLessThan(200000); // Average chunk should be reasonable
      expect(avgLoadTime).toBeLessThan(100); // Average load time should be fast
    });
  });

  describe('Real User Monitoring (RUM)', () => {
    test('should collect user interaction metrics', () => {
      const interactions = [
        { type: 'click', target: 'create-project-button', duration: 5 },
        { type: 'input', target: 'project-name-field', duration: 150 },
        { type: 'scroll', target: 'project-list', duration: 20 }
      ];

      interactions.forEach(interaction => {
        performanceMonitor.recordUserInteraction(
          interaction.type,
          interaction.target,
          interaction.duration
        );
      });

      const interactionMetrics = performanceMonitor.getInteractionMetrics();
      expect(interactionMetrics).toHaveLength(3);
      
      const inputInteraction = interactionMetrics.find(i => i.type === 'input');
      expect(inputInteraction?.duration).toBe(150);
    });

    test('should track page load performance across different conditions', () => {
      const pageLoads = [
        { 
          url: '/dashboard',
          loadTime: 1200,
          connectionType: '4g',
          deviceType: 'desktop'
        },
        {
          url: '/editor',
          loadTime: 2100,
          connectionType: '3g',
          deviceType: 'mobile'
        }
      ];

      pageLoads.forEach(load => {
        performanceMonitor.recordPageLoad(
          load.url,
          load.loadTime,
          {
            connectionType: load.connectionType,
            deviceType: load.deviceType
          }
        );
      });

      const pageLoadMetrics = performanceMonitor.getPageLoadMetrics();
      
      // Should show different performance for different conditions
      const desktopLoads = pageLoadMetrics.filter(p => p.context.deviceType === 'desktop');
      const mobileLoads = pageLoadMetrics.filter(p => p.context.deviceType === 'mobile');
      
      expect(desktopLoads[0].loadTime).toBeLessThan(mobileLoads[0].loadTime);
    });
  });

  describe('Performance Budget Monitoring', () => {
    test('should enforce performance budgets', () => {
      const budgets = {
        'bundle-size': 1000000, // 1MB
        'load-time': 3000, // 3 seconds
        'render-time': 16 // 16ms for 60fps
      };

      performanceMonitor.setPerformanceBudgets(budgets);

      // Test budget violations
      performanceMonitor.recordBundleLoad('large-bundle', 1500000, 200); // Exceeds size budget
      performanceMonitor.recordPageLoad('/slow-page', 4000); // Exceeds load time budget
      performanceMonitor.recordRenderTime('slow-component', 25); // Exceeds render time budget

      const violations = performanceMonitor.getBudgetViolations();
      
      expect(violations).toHaveLength(3);
      expect(violations.some(v => v.metric === 'bundle-size')).toBe(true);
      expect(violations.some(v => v.metric === 'load-time')).toBe(true);
      expect(violations.some(v => v.metric === 'render-time')).toBe(true);
    });
  });
});

// Mock implementation of performance monitor methods for testing
const mockPerformanceMonitor = {
  clearMetrics: jest.fn(),
  mark: jest.fn(),
  measure: jest.fn(),
  startTimer: jest.fn(),
  endTimer: jest.fn(() => 100),
  recordWebVital: jest.fn(),
  getMetrics: jest.fn(() => ({ webVitals: [] })),
  measureRenderTime: jest.fn(() => 50),
  getWarnings: jest.fn(() => []),
  recordMemoryUsage: jest.fn(),
  getMemoryMetrics: jest.fn(() => ({ current: 0 })),
  recordOperation: jest.fn(),
  identifyBottlenecks: jest.fn(() => []),
  recordBundleLoad: jest.fn(),
  getBundleMetrics: jest.fn(() => []),
  recordRouteLoad: jest.fn(),
  getRouteMetrics: jest.fn(() => []),
  recordUserInteraction: jest.fn(),
  getInteractionMetrics: jest.fn(() => []),
  recordPageLoad: jest.fn(),
  getPageLoadMetrics: jest.fn(() => []),
  setPerformanceBudgets: jest.fn(),
  getBudgetViolations: jest.fn(() => []),
  recordRenderTime: jest.fn()
};

// Replace the actual performance monitor with mock for testing
jest.mock('../performanceMonitor', () => ({
  performanceMonitor: mockPerformanceMonitor
}));