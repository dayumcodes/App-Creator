import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { databaseService } from './services/DatabaseService';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import generateRoutes from './routes/generate';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with database status
app.get('/health', async (_req, res) => {
  try {
    const dbHealthy = await databaseService.healthCheck();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
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

// Database connection and server startup
async function startServer() {
  try {
    // Connect to database
    await databaseService.connect();
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await databaseService.disconnect();
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
