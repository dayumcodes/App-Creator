import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../utils/performanceMonitor';
import { cacheService } from '../services/CacheService';
import { auth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get performance metrics dashboard
 */
router.get('/dashboard', auth, async (req: Request, res: Response) => {
  try {
    const { timeWindow = 300000, limit = 100 } = req.query; // 5 minutes default
    
    const healthStatus = performanceMonitor.getHealthStatus();
    const recentMetrics = performanceMonitor.getMetrics(undefined, Number(limit));
    const recentAlerts = performanceMonitor.getAlerts(50);
    
    // Calculate cache hit rate
    const cacheHits = performanceMonitor.getMetrics('cache_hit', 100);
    const cacheMisses = performanceMonitor.getMetrics('cache_miss', 100);
    const totalCacheRequests = cacheHits.length + cacheMisses.length;
    const cacheHitRate = totalCacheRequests > 0 ? (cacheHits.length / totalCacheRequests) * 100 : 0;
    
    // Calculate average response times
    const apiResponseTimes = performanceMonitor.getMetrics('api_response_time', 100);
    const avgResponseTime = apiResponseTimes.length > 0 
      ? apiResponseTimes.reduce((sum, m) => sum + m.value, 0) / apiResponseTimes.length 
      : 0;
    
    // Get database query performance
    const dbQueryTimes = performanceMonitor.getMetrics('database_query_time', 100);
    const avgDbQueryTime = dbQueryTimes.length > 0
      ? dbQueryTimes.reduce((sum, m) => sum + m.value, 0) / dbQueryTimes.length
      : 0;

    res.json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      summary: {
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        avgDbQueryTime: Math.round(avgDbQueryTime * 100) / 100,
        totalAlerts: recentAlerts.length,
        criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
      },
      metrics: healthStatus.metrics,
      recentAlerts: recentAlerts.slice(0, 10),
      systemInfo: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV,
      }
    });
  } catch (error) {
    logger.error('Performance dashboard error:', error);
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

/**
 * Get specific metric data
 */
router.get('/metrics/:metricName', auth, async (req: Request, res: Response) => {
  try {
    const { metricName } = req.params;
    const { limit = 100, timeWindow = 3600000 } = req.query; // 1 hour default
    
    const metrics = performanceMonitor.getMetrics(metricName, Number(limit));
    const average = performanceMonitor.getAverageMetric(metricName, Number(timeWindow));
    
    res.json({
      metricName,
      count: metrics.length,
      average,
      metrics: metrics.map(m => ({
        value: m.value,
        unit: m.unit,
        timestamp: m.timestamp,
        context: m.context
      }))
    });
  } catch (error) {
    logger.error('Metric retrieval error:', error);
    res.status(500).json({ error: 'Failed to get metric data' });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', auth, async (req: Request, res: Response) => {
  try {
    const cacheHits = performanceMonitor.getMetrics('cache_hit', 1000);
    const cacheMisses = performanceMonitor.getMetrics('cache_miss', 1000);
    const cacheErrors = performanceMonitor.getMetrics('cache_error', 1000);
    const cacheGetTimes = performanceMonitor.getMetrics('cache_get_time', 1000);
    const cacheSetTimes = performanceMonitor.getMetrics('cache_set_time', 1000);
    
    const totalRequests = cacheHits.length + cacheMisses.length;
    const hitRate = totalRequests > 0 ? (cacheHits.length / totalRequests) * 100 : 0;
    
    const avgGetTime = cacheGetTimes.length > 0
      ? cacheGetTimes.reduce((sum, m) => sum + m.value, 0) / cacheGetTimes.length
      : 0;
      
    const avgSetTime = cacheSetTimes.length > 0
      ? cacheSetTimes.reduce((sum, m) => sum + m.value, 0) / cacheSetTimes.length
      : 0;

    res.json({
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      hits: cacheHits.length,
      misses: cacheMisses.length,
      errors: cacheErrors.length,
      avgGetTime: Math.round(avgGetTime * 100) / 100,
      avgSetTime: Math.round(avgSetTime * 100) / 100,
      errorRate: totalRequests > 0 ? (cacheErrors.length / totalRequests) * 100 : 0
    });
  } catch (error) {
    logger.error('Cache stats error:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

/**
 * Set performance thresholds
 */
router.post('/thresholds', auth, async (req: Request, res: Response) => {
  try {
    const { metricName, warning, critical } = req.body;
    
    if (!metricName || typeof warning !== 'number' || typeof critical !== 'number') {
      return res.status(400).json({ error: 'Invalid threshold data' });
    }
    
    if (warning >= critical) {
      return res.status(400).json({ error: 'Warning threshold must be less than critical threshold' });
    }
    
    performanceMonitor.setThreshold(metricName, warning, critical);
    
    logger.info(`Performance threshold updated: ${metricName}`, {
      warning,
      critical,
      userId: req.user?.id
    });
    
    res.json({ 
      success: true, 
      metricName, 
      thresholds: { warning, critical } 
    });
  } catch (error) {
    logger.error('Threshold update error:', error);
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

/**
 * Clear performance data (admin only)
 */
router.delete('/data', auth, async (req: Request, res: Response) => {
  try {
    // In a real implementation, you'd check for admin permissions
    // For now, we'll just log the action
    logger.warn('Performance data clear requested', {
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      message: 'Performance data clear logged (not implemented for safety)' 
    });
  } catch (error) {
    logger.error('Performance data clear error:', error);
    res.status(500).json({ error: 'Failed to clear performance data' });
  }
});

export default router;