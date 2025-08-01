import React, { Suspense, ComponentType } from 'react';

interface LazyLoadOptions {
  fallback?: React.ComponentType;
  delay?: number;
}

// Default loading component
const DefaultFallback: React.FC = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p className="loading-message">Loading component...</p>
  </div>
);

/**
 * Higher-order component for lazy loading with customizable fallback
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): React.ComponentType<React.ComponentProps<T>> {
  const { fallback: Fallback = DefaultFallback, delay = 0 } = options;

  const LazyComponent = React.lazy(() => {
    if (delay > 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(importFunc());
        }, delay);
      });
    }
    return importFunc();
  });

  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <Suspense fallback={<Fallback />}>
      <LazyComponent {...props} ref={ref} />
    </Suspense>
  ));
}

/**
 * Preload a lazy component
 */
export function preloadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): void {
  importFunc().catch(() => {
    // Silently ignore preload errors
  });
}

/**
 * Lazy load with retry mechanism
 */
export function lazyLoadWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  maxRetries: number = 3,
  options: LazyLoadOptions = {}
): React.ComponentType<React.ComponentProps<T>> {
  const retryImport = async (retryCount = 0): Promise<{ default: T }> => {
    try {
      return await importFunc();
    } catch (error) {
      if (retryCount < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryImport(retryCount + 1);
      }
      throw error;
    }
  };

  return lazyLoad(() => retryImport(), options);
}