import { PrismaClient } from '../generated/prisma';

// Global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create a singleton Prisma client instance
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// In development, store the client in global to prevent multiple instances
if (process.env['NODE_ENV'] === 'development') {
  globalThis.__prisma = prisma;
}

// Connection management functions
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(callback);
};

export default prisma;