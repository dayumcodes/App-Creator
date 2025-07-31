import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { databaseService } from './services/DatabaseService';
import { SocketService } from './services/SocketService';
import { PrismaClient } from './generated/prisma';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import generateRoutes from './routes/generate';
import previewRoutes from './routes/preview';
import versionRoutes from './routes/versions';
import deploymentRoutes from './routes/deployments';
import collaborationRoutes from './routes/collaboration';

// Import error handling and monitoring
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { errorReporter } from './utils/errorReporting';
import { performanceMonitor, performanceMiddleware } from './utils/performanceMonitor';
import { debugMode } from './utils/debugMode';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize error reporting
errorReporter.initialize();

const app = express();
const server = createServer(app);
const PORT = process.env['PORT'] || 3001;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Socket.IO service
const socketService = new SocketService(server, prisma);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware
app.use(performanceMiddleware);

// Health check endpoint with database status and performance metrics
app.get('/health', async (_req, res) => {
  try {
    const dbHealthy = await databaseService.healthCheck();
    const healthStatus = performanceMonitor.getHealthStatus();
    
    res.json({ 
      status: healthStatus.status === 'healthy' && dbHealthy ? 'OK' : 'WARNING',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      performance: {
        status: healthStatus.status,
        recentAlerts: healthStatus.recentAlerts.length,
        metrics: Object.keys(healthStatus.metrics).length,
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Lovable Clone API' });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Project routes
app.use('/api/projects', projectRoutes);

// Code generation routes
app.use('/api/generate', generateRoutes);

// Preview routes
app.use('/api/preview', previewRoutes);

// Version control routes
app.use('/api', versionRoutes);

// Deployment routes
app.use('/api/deployments', deploymentRoutes);

// Collaboration routes
app.use('/api/collaboration', collaborationRoutes);

// Debug endpoints (only in development)
if (process.env.NODE_ENV === 'development') {
  const debugEndpoints = debugMode.createDebugEndpoint();
  app.get('/debug/info', debugEndpoints.getInfo);
  app.get('/debug/logs', debugEndpoints.getLogs);
  app.post('/debug/category', debugEndpoints.toggleCategory);
  app.delete('/debug/logs', debugEndpoints.clearLogs);
  app.get('/debug/export', debugEndpoints.exportLogs);
}

// Error reporting endpoint
app.post('/api/errors/report', (req, res) => {
  try {
    const { errors } = req.body;
    
    if (Array.isArray(errors)) {
      errors.forEach(errorData => {
        logger.error('Frontend error reported', errorData);
        
        // Report to error tracking service
        const error = new Error(errorData.message);
        error.stack = errorData.stack;
        
        errorReporter.reportError(error, {
          userId: errorData.context?.userId,
          metadata: {
            ...errorData.context,
            userAgent: errorData.userAgent,
            url: errorData.url,
            timestamp: errorData.timestamp,
          },
          severity: errorData.severity || 'medium',
        });
      });
    } else {
      // Single error report
      logger.error('Frontend error reported', req.body);
      
      const error = new Error(req.body.message);
      error.stack = req.body.stack;
      
      errorReporter.reportError(error, {
        userId: req.body.context?.userId,
        metadata: {
          ...req.body.context,
          userAgent: req.body.userAgent,
          url: req.body.url,
          timestamp: req.body.timestamp,
        },
        severity: req.body.severity || 'medium',
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to process error report', error);
    res.status(500).json({ success: false, error: 'Failed to process error report' });
  }
});

// Performance reporting endpoint
app.post('/api/performance/report', (req, res) => {
  try {
    const { webVitals, performanceEntries, summary } = req.body;
    
    // Log performance data
    logger.info('Frontend performance data', {
      webVitals,
      performanceEntries: performanceEntries?.slice(-10), // Log only recent entries
      summary,
      timestamp: req.body.timestamp,
      url: req.body.url,
    });
    
    // Track performance metrics
    if (webVitals) {
      webVitals.forEach((vital: any) => {
        performanceMonitor.recordMetric({
          name: `frontend_${vital.name.toLowerCase()}`,
          value: vital.value,
          unit: 'ms',
          timestamp: new Date(vital.timestamp),
          context: {
            rating: vital.rating,
            url: req.body.url,
          },
        });
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to process performance report', error);
    res.status(500).json({ success: false, error: 'Failed to process performance report' });
  }
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Database connection and server startup
async function startServer() {
  try {
    // Connect to database
    await databaseService.connect();
    console.log('✅ Database connected successfully');

    // Start server with Socket.IO support
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
        debugMode: debugMode.getEnabledCategories().length > 0,
      });
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket server ready for real-time collaboration`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await databaseService.disconnect();
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await databaseService.disconnect();
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server only if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
