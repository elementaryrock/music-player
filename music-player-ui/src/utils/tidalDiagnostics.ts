/**
 * Tidal API Diagnostics Utility
 * 
 * Provides comprehensive diagnostics for Tidal API connectivity issues
 */

import { testTidalApiConnection, getTidalEndpointHealth, resetTidalEndpointHealth } from '../services/tidalApiFixed';

export interface DiagnosticResult {
  timestamp: Date;
  environment: {
    userAgent: string;
    isDevMode: boolean;
    hasViteProxy: boolean;
    corsSupport: boolean;
  };
  connectivity: {
    online: boolean;
    connectionType?: string;
  };
  endpoints: Array<{
    name: string;
    url: string;
    isHealthy: boolean;
    lastSuccess: Date | null;
    lastFailure: Date | null;
    consecutiveFailures: number;
  }>;
  testResults: {
    success: boolean;
    workingEndpoint?: string;
    error?: string;
    diagnostics: Array<{
      endpoint: string;
      success: boolean;
      responseTime?: number;
      error?: string;
    }>;
  };
  recommendations: string[];
}

/**
 * Run comprehensive Tidal API diagnostics
 */
export async function runTidalDiagnostics(): Promise<DiagnosticResult> {
  console.log('🔍 Running Tidal API diagnostics...');
  
  const startTime = new Date();
  
  // Gather environment information
  const environment = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
    isDevMode: process.env.NODE_ENV === 'development',
    hasViteProxy: await checkViteProxyAvailability(),
    corsSupport: await checkCorsSupport(),
    hiFiApiAvailable: await checkHiFiApiAvailability(),
  };

  // Check connectivity
  const connectivity = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: getConnectionType(),
  };

  // Get endpoint health
  const endpoints = getTidalEndpointHealth();

  // Run connection test
  const testResults = await testTidalApiConnection();

  // Generate recommendations
  const recommendations = generateRecommendations(environment, connectivity, testResults);

  const result: DiagnosticResult = {
    timestamp: startTime,
    environment,
    connectivity,
    endpoints,
    testResults,
    recommendations,
  };

  console.log('✅ Diagnostics complete:', result);
  return result;
}

/**
 * Check if Vite proxy endpoints are available
 */
async function checkViteProxyAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/tidal/song/?q=test&quality=HIGH', {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status < 500; // Even 404 means proxy is working
  } catch (error) {
    return false;
  }
}

/**
 * Check HiFi API availability specifically
 */
async function checkHiFiApiAvailability(): Promise<boolean> {
  try {
    const response = await fetch('https://hifi.401658.xyz/song/?q=test&quality=HIGH', {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok || response.status < 500;
  } catch (error) {
    return false;
  }
}

/**
 * Check CORS support by attempting a direct API call
 */
async function checkCorsSupport(): Promise<boolean> {
  try {
    const response = await fetch('https://tidal.401658.xyz/song/?q=test&quality=HIGH', {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    return true; // If we get here, CORS is working
  } catch (error) {
    // Check if it's a CORS error vs network error
    const errorMessage = error instanceof Error ? error.message : '';
    return !errorMessage.toLowerCase().includes('cors');
  }
}

/**
 * Get connection type information
 */
function getConnectionType(): string | undefined {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as any).connection;
    return connection?.effectiveType || connection?.type;
  }
  return undefined;
}

/**
 * Generate recommendations based on diagnostic results
 */
function generateRecommendations(
  environment: DiagnosticResult['environment'],
  connectivity: DiagnosticResult['connectivity'],
  testResults: DiagnosticResult['testResults']
): string[] {
  const recommendations: string[] = [];

  // Connection issues
  if (!connectivity.online) {
    recommendations.push('Check your internet connection - you appear to be offline');
  }

  // Development vs production issues
  if (environment.isDevMode && !environment.hasViteProxy) {
    recommendations.push('Vite proxy is not working - restart your development server');
    recommendations.push('Ensure vite.config.ts has the correct proxy configuration for HiFi API');
  }

  if (!environment.isDevMode && !environment.corsSupport) {
    recommendations.push('CORS is blocking direct API calls - this is expected in production');
    recommendations.push('Consider using a CORS proxy or server-side API calls');
  }

  // HiFi-specific recommendations
  if (!(environment as any).hiFiApiAvailable) {
    recommendations.push('HiFi API (https://hifi.401658.xyz/) is not accessible');
    recommendations.push('Check if the HiFi endpoint is working: https://hifi.401658.xyz/tdoc');
    recommendations.push('Consider falling back to legacy Tidal endpoints');
  } else if (testResults.success) {
    recommendations.push('HiFi API is working great! 🎵');
  }

  // API-specific issues
  if (!testResults.success) {
    if (testResults.diagnostics.every(d => d.error?.includes('timeout'))) {
      recommendations.push('All endpoints are timing out - check your network connection');
      recommendations.push('Try using a VPN if you suspect regional blocking');
    }

    if (testResults.diagnostics.some(d => d.error?.includes('404'))) {
      recommendations.push('Some API endpoints may have changed - check API documentation');
    }

    if (testResults.diagnostics.some(d => d.error?.includes('403') || d.error?.includes('401'))) {
      recommendations.push('API access may be restricted - check if authentication is required');
    }

    recommendations.push('Try resetting endpoint health status');
    recommendations.push('Consider using alternative music APIs as fallback');
  }

  // Performance recommendations
  const avgResponseTime = testResults.diagnostics
    .filter(d => d.success && d.responseTime)
    .reduce((sum, d) => sum + (d.responseTime || 0), 0) / 
    testResults.diagnostics.filter(d => d.success).length;

  if (avgResponseTime > 5000) {
    recommendations.push('API response times are slow - consider caching results');
  }

  // Browser-specific recommendations
  if (environment.userAgent.includes('Safari') && !environment.userAgent.includes('Chrome')) {
    recommendations.push('Safari may have stricter CORS policies - try Chrome for testing');
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems appear to be working correctly! 🎉');
  }

  return recommendations;
}

/**
 * Format diagnostic results for display
 */
export function formatDiagnosticResults(result: DiagnosticResult): string {
  const lines: string[] = [];
  
  lines.push('🔍 TIDAL API DIAGNOSTICS REPORT');
  lines.push('═'.repeat(50));
  lines.push(`Timestamp: ${result.timestamp.toISOString()}`);
  lines.push('');

  // Environment
  lines.push('🌍 ENVIRONMENT');
  lines.push(`Development Mode: ${result.environment.isDevMode ? '✅' : '❌'}`);
  lines.push(`Vite Proxy Available: ${result.environment.hasViteProxy ? '✅' : '❌'}`);
  lines.push(`CORS Support: ${result.environment.corsSupport ? '✅' : '❌'}`);
  lines.push(`HiFi API Available: ${(result.environment as any).hiFiApiAvailable ? '✅' : '❌'}`);
  lines.push(`User Agent: ${result.environment.userAgent}`);
  lines.push('');

  // Connectivity
  lines.push('🌐 CONNECTIVITY');
  lines.push(`Online Status: ${result.connectivity.online ? '✅' : '❌'}`);
  if (result.connectivity.connectionType) {
    lines.push(`Connection Type: ${result.connectivity.connectionType}`);
  }
  lines.push('');

  // Endpoints
  lines.push('🔗 ENDPOINT HEALTH');
  result.endpoints.forEach(endpoint => {
    const status = endpoint.isHealthy ? '✅' : '❌';
    const failures = endpoint.consecutiveFailures > 0 ? ` (${endpoint.consecutiveFailures} failures)` : '';
    lines.push(`${status} ${endpoint.name}${failures}`);
  });
  lines.push('');

  // Test Results
  lines.push('🧪 CONNECTION TEST');
  lines.push(`Overall Result: ${result.testResults.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (result.testResults.workingEndpoint) {
    lines.push(`Working Endpoint: ${result.testResults.workingEndpoint}`);
  }
  if (result.testResults.error) {
    lines.push(`Error: ${result.testResults.error}`);
  }
  lines.push('');

  // Individual endpoint results
  lines.push('📊 ENDPOINT TEST RESULTS');
  result.testResults.diagnostics.forEach(diagnostic => {
    const status = diagnostic.success ? '✅' : '❌';
    const time = diagnostic.responseTime ? ` (${diagnostic.responseTime}ms)` : '';
    const error = diagnostic.error ? ` - ${diagnostic.error}` : '';
    lines.push(`${status} ${diagnostic.endpoint}${time}${error}`);
  });
  lines.push('');

  // Recommendations
  lines.push('💡 RECOMMENDATIONS');
  result.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1}. ${rec}`);
  });

  return lines.join('\n');
}

/**
 * Auto-fix common Tidal API issues
 */
export async function autoFixTidalIssues(): Promise<{
  applied: string[];
  failed: string[];
}> {
  const applied: string[] = [];
  const failed: string[] = [];

  console.log('🔧 Attempting to auto-fix Tidal API issues...');

  try {
    // Reset endpoint health
    resetTidalEndpointHealth();
    applied.push('Reset endpoint health status');
  } catch (error) {
    failed.push('Failed to reset endpoint health');
  }

  try {
    // Clear any cached DNS
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      applied.push('Cleared service worker cache');
    }
  } catch (error) {
    // Service worker clearing is optional
  }

  try {
    // Test connection after fixes
    const testResult = await testTidalApiConnection();
    if (testResult.success) {
      applied.push('Verified connection is working after fixes');
    } else {
      failed.push('Connection still not working after fixes');
    }
  } catch (error) {
    failed.push('Failed to test connection after fixes');
  }

  console.log('🔧 Auto-fix complete:', { applied, failed });
  return { applied, failed };
}

/**
 * Export diagnostic functions to window for browser console access
 */
if (typeof window !== 'undefined') {
  (window as any).runTidalDiagnostics = runTidalDiagnostics;
  (window as any).formatTidalDiagnostics = (result: DiagnosticResult) => {
    console.log(formatDiagnosticResults(result));
    return result;
  };
  (window as any).autoFixTidal = autoFixTidalIssues;
  
  console.log('🔧 Tidal diagnostics available in console:');
  console.log('  - runTidalDiagnostics()');
  console.log('  - formatTidalDiagnostics(result)');
  console.log('  - autoFixTidal()');
}