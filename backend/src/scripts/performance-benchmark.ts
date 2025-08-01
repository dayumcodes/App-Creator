#!/usr/bin/env tsx

import { performance } from 'perf_hooks';
import { CacheService } from '../services/CacheService';
import { databaseService } from '../services/DatabaseService';
import { performanceMonitor } from '../utils/performanceMonitor';
import { logger } from '../utils/logger';

interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsage: NodeJS.MemoryUsage;
  details?: any;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance Benchmark Suite...\n');
    
    try {
      await databaseService.connect();
      await this.cacheService.connect();
      console.log('✅ Database and Cache connections established\n');
    } catch (error) {
      console.error('❌ Failed to initialize connections:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.cacheService.disconnect();
      await databaseService.disconnect();
      console.log('✅ Connections closed\n');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  private async runBenchmark(
    name: string,
    operation: () => Promise<void>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    console.log(`📊 Running benchmark: ${name} (${iterations} iterations)`);
    
    // Warm up
    for (let i = 0; i < Math.min(10, iterations); i++) {
      await operation();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage();
    const startTime = performance.now();

    // Run benchmark
    for (let i = 0; i < iterations; i++) {
      await operation();
    }

    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const opsPerSecond = (iterations / duration) * 1000;

    const result: BenchmarkResult = {
      name,
      duration,
      operations: iterations,
      opsPerSecond,
      memoryUsage: {
        rss: finalMemory.rss - initialMemory.rss,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        external: finalMemory.external - initialMemory.external,
        arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers
      }
    };

    this.results.push(result);
    
    console.log(`   ⏱️  Duration: ${duration.toFixed(2)}ms`);
    console.log(`   🔄 Operations/sec: ${opsPerSecond.toFixed(2)}`);
    console.log(`   💾 Memory delta: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`);

    return result;
  }

  async benchmarkCacheOperations(): Promise<void> {
    console.log('🗄️  Cache Operations Benchmarks\n');

    // Cache SET operations
    let counter = 0;
    await this.runBenchmark(
      'Cache SET operations',
      async () => {
        await this.cacheService.set(`benchmark-key-${counter++}`, {
          id: counter,
          data: `test-data-${counter}`,
          timestamp: Date.now()
        });
      },
      1000
    );

    // Cache GET operations (with existing data)
    await this.runBenchmark(
      'Cache GET operations (hits)',
      async () => {
        const key = `benchmark-key-${Math.floor(Math.random() * 1000)}`;
        await this.cacheService.get(key);
      },
      1000
    );

    // Cache GET operations (misses)
    await this.runBenchmark(
      'Cache GET operations (misses)',
      async () => {
        const key = `missing-key-${Math.random()}`;
        await this.cacheService.get(key);
      },
      500
    );

    // Large object caching
    const largeObject = {
      id: 'large-object',
      data: Array.from({ length: 1000 }, (_, i) => ({
        index: i,
        value: `large-data-${i}`.repeat(10),
        nested: { level1: { level2: { value: i } } }
      }))
    };

    await this.runBenchmark(
      'Large object cache SET',
      async () => {
        await this.cacheService.set(`large-object-${Math.random()}`, largeObject);
      },
      100
    );

    await this.runBenchmark(
      'Large object cache GET',
      async () => {
        await this.cacheService.get('large-object-0');
      },
      100
    );
  }

  async benchmarkDatabaseOperations(): Promise<void> {
    console.log('🗃️  Database Operations Benchmarks\n');

    const { prisma } = databaseService as any;

    // User creation
    await this.runBenchmark(
      'User creation',
      async () => {
        const randomId = Math.random().toString(36).substring(7);
        await prisma.user.create({
          data: {
            email: `benchmark-${randomId}@example.com`,
            username: `benchmark-${randomId}`,
            passwordHash: 'hashed-password'
          }
        });
      },
      100
    );

    // User queries
    await this.runBenchmark(
      'User queries by email',
      async () => {
        await prisma.user.findFirst({
          where: {
            email: { contains: 'benchmark' }
          }
        });
      },
      500
    );

    // Project creation with relations
    const users = await prisma.user.findMany({ take: 10 });
    if (users.length > 0) {
      await this.runBenchmark(
        'Project creation with relations',
        async () => {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          await prisma.project.create({
            data: {
              name: `Benchmark Project ${Math.random()}`,
              description: 'Performance test project',
              userId: randomUser.id
            }
          });
        },
        100
      );
    }

    // Complex queries with joins
    await this.runBenchmark(
      'Complex queries with joins',
      async () => {
        await prisma.project.findMany({
          include: {
            user: true,
            files: true,
            prompts: { take: 5 }
          },
          take: 10
        });
      },
      200
    );
  }

  async benchmarkPerformanceMonitoring(): Promise<void> {
    console.log('📈 Performance Monitoring Benchmarks\n');

    // Metric recording
    await this.runBenchmark(
      'Performance metric recording',
      async () => {
        performanceMonitor.recordMetric({
          name: 'benchmark-metric',
          value: Math.random() * 1000,
          unit: 'ms',
          timestamp: new Date(),
          context: { test: 'benchmark' }
        });
      },
      1000
    );

    // Timer operations
    await this.runBenchmark(
      'Timer start/end operations',
      async () => {
        const timerName = `benchmark-timer-${Math.random()}`;
        performanceMonitor.startTimer(timerName);
        await new Promise(resolve => setTimeout(resolve, 1));
        performanceMonitor.endTimer(timerName);
      },
      500
    );

    // Metric retrieval
    await this.runBenchmark(
      'Metric retrieval',
      async () => {
        performanceMonitor.getMetrics('benchmark-metric', 100);
      },
      1000
    );
  }

  async benchmarkMemoryOperations(): Promise<void> {
    console.log('💾 Memory Operations Benchmarks\n');

    // Large array operations
    await this.runBenchmark(
      'Large array creation and manipulation',
      async () => {
        const largeArray = new Array(10000).fill(0).map((_, i) => ({
          id: i,
          data: `item-${i}`,
          timestamp: Date.now()
        }));
        
        // Simulate processing
        largeArray.forEach(item => {
          item.processed = true;
        });
        
        // Cleanup
        largeArray.length = 0;
      },
      100
    );

    // JSON serialization/deserialization
    const complexObject = {
      users: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        projects: Array.from({ length: 5 }, (_, j) => ({
          id: j,
          name: `Project ${j}`,
          files: Array.from({ length: 10 }, (_, k) => ({
            name: `file${k}.js`,
            content: `console.log('Hello from file ${k}');`.repeat(10)
          }))
        }))
      }))
    };

    await this.runBenchmark(
      'JSON serialization',
      async () => {
        JSON.stringify(complexObject);
      },
      100
    );

    const serialized = JSON.stringify(complexObject);
    await this.runBenchmark(
      'JSON deserialization',
      async () => {
        JSON.parse(serialized);
      },
      100
    );
  }

  async benchmarkConcurrentOperations(): Promise<void> {
    console.log('🔄 Concurrent Operations Benchmarks\n');

    // Concurrent cache operations
    await this.runBenchmark(
      'Concurrent cache operations',
      async () => {
        const operations = Array.from({ length: 10 }, (_, i) => {
          const key = `concurrent-${i}-${Math.random()}`;
          return this.cacheService.set(key, { data: `concurrent-data-${i}` });
        });
        await Promise.all(operations);
      },
      100
    );

    // Concurrent database queries
    const { prisma } = databaseService as any;
    await this.runBenchmark(
      'Concurrent database queries',
      async () => {
        const queries = Array.from({ length: 5 }, () => 
          prisma.user.findMany({ take: 10 })
        );
        await Promise.all(queries);
      },
      100
    );
  }

  generateReport(): void {
    console.log('📋 Performance Benchmark Report\n');
    console.log('=' .repeat(80));
    
    const categories = this.groupResultsByCategory();
    
    for (const [category, results] of Object.entries(categories)) {
      console.log(`\n📊 ${category.toUpperCase()}`);
      console.log('-'.repeat(60));
      
      results.forEach(result => {
        console.log(`${result.name}:`);
        console.log(`  ⏱️  Duration: ${result.duration.toFixed(2)}ms`);
        console.log(`  🔄 Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
        console.log(`  💾 Memory: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log('');
      });
    }

    // Summary statistics
    console.log('\n📈 SUMMARY STATISTICS');
    console.log('-'.repeat(60));
    
    const totalOperations = this.results.reduce((sum, r) => sum + r.operations, 0);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgOpsPerSecond = this.results.reduce((sum, r) => sum + r.opsPerSecond, 0) / this.results.length;
    const totalMemoryUsed = this.results.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0);
    
    console.log(`Total Operations: ${totalOperations.toLocaleString()}`);
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Average Ops/sec: ${avgOpsPerSecond.toFixed(2)}`);
    console.log(`Total Memory Used: ${(totalMemoryUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // Performance recommendations
    this.generateRecommendations();
  }

  private groupResultsByCategory(): Record<string, BenchmarkResult[]> {
    const categories: Record<string, BenchmarkResult[]> = {};
    
    this.results.forEach(result => {
      let category = 'Other';
      
      if (result.name.toLowerCase().includes('cache')) {
        category = 'Cache Operations';
      } else if (result.name.toLowerCase().includes('database') || result.name.toLowerCase().includes('user') || result.name.toLowerCase().includes('project')) {
        category = 'Database Operations';
      } else if (result.name.toLowerCase().includes('performance') || result.name.toLowerCase().includes('metric')) {
        category = 'Performance Monitoring';
      } else if (result.name.toLowerCase().includes('memory') || result.name.toLowerCase().includes('json')) {
        category = 'Memory Operations';
      } else if (result.name.toLowerCase().includes('concurrent')) {
        category = 'Concurrent Operations';
      }
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(result);
    });
    
    return categories;
  }

  private generateRecommendations(): void {
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS');
    console.log('-'.repeat(60));
    
    const slowOperations = this.results.filter(r => r.opsPerSecond < 100);
    const memoryIntensive = this.results.filter(r => r.memoryUsage.heapUsed > 10 * 1024 * 1024); // >10MB
    
    if (slowOperations.length > 0) {
      console.log('⚠️  Slow Operations (< 100 ops/sec):');
      slowOperations.forEach(op => {
        console.log(`   - ${op.name}: ${op.opsPerSecond.toFixed(2)} ops/sec`);
      });
      console.log('   💡 Consider optimizing these operations or adding caching\n');
    }
    
    if (memoryIntensive.length > 0) {
      console.log('⚠️  Memory Intensive Operations (> 10MB):');
      memoryIntensive.forEach(op => {
        console.log(`   - ${op.name}: ${(op.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      });
      console.log('   💡 Consider memory optimization or streaming for large data\n');
    }
    
    // Cache performance analysis
    const cacheResults = this.results.filter(r => r.name.toLowerCase().includes('cache'));
    if (cacheResults.length > 0) {
      const avgCacheOps = cacheResults.reduce((sum, r) => sum + r.opsPerSecond, 0) / cacheResults.length;
      if (avgCacheOps < 1000) {
        console.log('⚠️  Cache performance is below optimal (< 1000 ops/sec)');
        console.log('   💡 Consider Redis configuration tuning or connection pooling\n');
      }
    }
    
    console.log('✅ Benchmark completed successfully!');
  }
}

// Main execution
async function main() {
  const benchmark = new PerformanceBenchmark();
  
  try {
    await benchmark.initialize();
    
    await benchmark.benchmarkCacheOperations();
    await benchmark.benchmarkDatabaseOperations();
    await benchmark.benchmarkPerformanceMonitoring();
    await benchmark.benchmarkMemoryOperations();
    await benchmark.benchmarkConcurrentOperations();
    
    benchmark.generateReport();
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceBenchmark };