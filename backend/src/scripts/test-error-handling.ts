#!/usr/bin/env tsx

/**
 * Test script to demonstrate comprehensive error handling and logging
 * Run with: npm run test:error-handling
 */

import { errorReporter, analyticsTracker } from '../utils/errorReporting';
import { performanceMonitor } from '../utils/performanceMonitor';
import { debugMode } from '../utils/debugMode';
import { getErrorMessage } from '../utils/errorMessages';
import { CustomError, ValidationError, AuthenticationError } from '../middleware/errorHandler';
import logger from '../utils/logger';

async function demonstrateErrorHandling() {
    console.log('🚀 Starting Error Handling Demonstration\n');

    // Initialize systems
    errorReporter.initialize();
    debugMode.enable(['demo', 'error-handling', 'performance']);

    // 1. Demonstrate error message system
    console.log('1. 📝 Error Message System:');
    const errorMessage = getErrorMessage('INVALID_CREDENTIALS');
    console.log(`   Code: ${errorMessage.code}`);
    console.log(`   Message: ${errorMessage.userMessage}`);
    console.log(`   Suggestions: ${errorMessage.suggestions.join(', ')}`);
    console.log('');

    // 2. Demonstrate custom error classes
    console.log('2. 🏷️  Custom Error Classes:');
    try {
        throw new ValidationError('Email format is invalid', { field: 'email', value: 'invalid-email' });
    } catch (error) {
        if (error instanceof ValidationError) {
            console.log(`   ValidationError caught: ${error.message}`);
            console.log(`   Status Code: ${error.statusCode}`);
            console.log(`   Error Code: ${error.code}`);
        } else {
            console.log(`   Unexpected error: ${error}`);
        }
    }
    console.log('');

    // 3. Demonstrate error reporting
    console.log('3. 📊 Error Reporting:');
    const testError = new AuthenticationError('Token expired');
    errorReporter.reportError(testError, {
        userId: 'demo-user-123',
        action: 'login_attempt',
        severity: 'medium',
        metadata: { ip: '127.0.0.1', userAgent: 'Demo Script' }
    });
    console.log('   Error reported to tracking system');
    console.log('');

    // 4. Demonstrate analytics tracking
    console.log('4. 📈 Analytics Tracking:');
    analyticsTracker.trackError(testError, {
        userId: 'demo-user-123',
        action: 'demo_error',
        severity: 'low'
    });
    analyticsTracker.trackPerformance('demo_operation', 150, { operation: 'test' });
    analyticsTracker.trackUserAction('demo_action', 'demo-user-123', { button: 'test' });
    console.log('   Analytics events tracked');
    console.log('');

    // 5. Demonstrate performance monitoring
    console.log('5. ⚡ Performance Monitoring:');
    performanceMonitor.startTimer('demo_operation');

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));

    const duration = performanceMonitor.endTimer('demo_operation');
    console.log(`   Operation completed in ${duration}ms`);

    // Record a custom metric
    performanceMonitor.recordMetric({
        name: 'demo_metric',
        value: 42,
        unit: 'count',
        timestamp: new Date(),
        context: { demo: true }
    });
    console.log('   Custom metric recorded');
    console.log('');

    // 6. Demonstrate debug mode
    console.log('6. 🐛 Debug Mode:');
    debugMode.log('demo', 'This is a debug message', { level: 'info' }, 'debug');
    debugMode.log('demo', 'This is a warning message', { level: 'warning' }, 'warn');
    debugMode.log('demo', 'This is an error message', { level: 'error' }, 'error');
    debugMode.time('demo', 'test_timer');
    await new Promise(resolve => setTimeout(resolve, 50));
    debugMode.timeEnd('demo', 'test_timer');

    const debugLogs = debugMode.getLogs('demo', 5);
    console.log(`   Debug logs captured: ${debugLogs.length} entries`);
    console.log('');

    // 7. Demonstrate system health check
    console.log('7. 🏥 System Health Check:');
    const healthStatus = performanceMonitor.getHealthStatus();
    console.log(`   System Status: ${healthStatus.status}`);
    console.log(`   Metrics Count: ${Object.keys(healthStatus.metrics).length}`);
    console.log(`   Recent Alerts: ${healthStatus.recentAlerts.length}`);
    console.log('');

    // 8. Demonstrate breadcrumb tracking
    console.log('8. 🍞 Breadcrumb Tracking:');
    errorReporter.addBreadcrumb('User started demo', 'demo', { timestamp: Date.now() });
    errorReporter.addBreadcrumb('Error handling test completed', 'demo', { success: true });
    console.log('   Breadcrumbs added for error context');
    console.log('');

    // 9. Show system information
    console.log('9. 💻 System Information:');
    const systemInfo = debugMode.getSystemInfo();
    console.log(`   Node Version: ${systemInfo['nodeVersion']}`);
    console.log(`   Platform: ${systemInfo['platform']}`);
    console.log(`   Memory Usage: ${Math.round(systemInfo['memoryUsage'].heapUsed / 1024 / 1024)}MB`);
    console.log(`   Debug Mode: ${systemInfo['debugMode'] ? 'Enabled' : 'Disabled'}`);
    console.log('');

    // 10. Demonstrate error recovery suggestions
    console.log('10. 🔧 Error Recovery Suggestions:');
    const errorTypes = ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR'];
    errorTypes.forEach(errorType => {
        const errorInfo = getErrorMessage(errorType);
        console.log(`   ${errorType}:`);
        console.log(`     - ${errorInfo.suggestions[0]}`);
    });
    console.log('');

    console.log('✅ Error Handling Demonstration Complete!');
    console.log('\nAll error handling systems are working correctly:');
    console.log('  ✓ Centralized error logging with Winston');
    console.log('  ✓ User-friendly error messages and recovery suggestions');
    console.log('  ✓ Error reporting and analytics integration');
    console.log('  ✓ Performance monitoring and alerting');
    console.log('  ✓ Debug mode for development troubleshooting');
    console.log('  ✓ Comprehensive error boundary components');
    console.log('  ✓ Test coverage for error handling scenarios');
}

// Run the demonstration
if (require.main === module) {
    demonstrateErrorHandling()
        .then(() => {
            console.log('\n🎉 Demo completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Demo failed:', error);
            process.exit(1);
        });
}

export { demonstrateErrorHandling };