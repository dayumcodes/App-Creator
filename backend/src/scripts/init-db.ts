#!/usr/bin/env tsx

import { databaseService } from '../services/DatabaseService';
import { execSync } from 'child_process';
import path from 'path';

async function initializeDatabase() {
  console.log('🚀 Initializing database...');

  try {
    // Check if database is accessible
    console.log('📡 Checking database connection...');
    await databaseService.connect();
    
    const isHealthy = await databaseService.healthCheck();
    if (!isHealthy) {
      throw new Error('Database is not healthy');
    }
    console.log('✅ Database connection successful');

    // Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { 
      cwd: path.join(__dirname, '../../'),
      stdio: 'inherit' 
    });
    console.log('✅ Prisma client generated');

    // Apply migrations
    console.log('📦 Applying database migrations...');
    try {
      execSync('npx prisma migrate deploy', { 
        cwd: path.join(__dirname, '../../'),
        stdio: 'inherit' 
      });
      console.log('✅ Migrations applied successfully');
    } catch (error) {
      console.log('⚠️  Migration failed, this might be expected for first run');
      console.log('   Trying to push schema directly...');
      
      try {
        execSync('npx prisma db push', { 
          cwd: path.join(__dirname, '../../'),
          stdio: 'inherit' 
        });
        console.log('✅ Schema pushed successfully');
      } catch (pushError) {
        console.error('❌ Failed to push schema:', pushError);
        throw pushError;
      }
    }

    // Run seed script
    console.log('🌱 Seeding database with initial data...');
    try {
      execSync('npm run db:seed', { 
        cwd: path.join(__dirname, '../../'),
        stdio: 'inherit' 
      });
      console.log('✅ Database seeded successfully');
    } catch (seedError) {
      console.log('⚠️  Seeding failed, this might be expected if data already exists');
    }

    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await databaseService.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };