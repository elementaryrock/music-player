/**
 * Tidal API Health Monitor Utility
 * 
 * Provides real-time monitoring and automatic recovery for Tidal API connections
 */

import { 
  testTidalApiConnection, 
  getTidalEndpointHealth, 
  resetTidalEndpointHealth,
  runTidalDiagnostics,
  autoFixTidalIssues
} from '../services/tidalApiFixed';

export interface HealthStatus {
  isHealthy: boolean;
  workingEndpoints: number;
  totalEndpoints: number;
  currentEndpoint?: string;
  lastCheck: Date;
  issues: string[];
  recommendations: string[];
}

export class TidalHealthMonitor {
  private static instance: TidalHealthMonitor;
  private healthStatus: HealthStatus;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(status: HealthStatus) => void> = [];

  private constructor() {
    this.healthStatus = {
      isHealthy: false,
      workingEndpoints: 0,
      totalEndpoints: 0,
      lastCheck: new Date(),
      issues: [],
      recommendations: [],
    };
  }

  public static getInstance(): TidalHealthMonitor {
    if (!TidalHealthMonitor.instance) {
      TidalHealthMonitor.instance = new TidalHealthMonitor();
    }
    return TidalHealthMonitor.instance;
  }

  /**
   * Start monitoring Tidal API health
   */
  public startMonitoring(intervalMs: number = 300000): void { // 5 minutes default
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log('🔍 Starting Tidal API health monitoring...');
    
    // Initial check
    this.performHealthCheck();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Stopped Tidal API health monitoring');
    }
  }

  /**
   * Perform a health check
   */
  public async performHealthCheck(): Promise<HealthStatus> {
    try {
      const diagnostics = await runTidalDiagnostics();
      
      this.healthStatus = {
        isHealthy: diagnostics.overall.success,
        workingEndpoints: diagnostics.overall.workingEndpoints,
        totalEndpoints: diagnostics.overall.totalEndpoints,
        currentEndpoint: diagnostics.overall.recommendedEndpoint,
        lastCheck: new Date(),
        issues: diagnostics.overall.issues,
        recommendations: diagnostics.recommendations,
      };

      // Notify listeners
      this.notifyListeners();

      // Auto-fix if needed and no endpoints are working
      if (!this.healthStatus.isHealthy && this.healthStatus.workingEndpoints === 0) {
        console.log('🔧 No working endpoints found, attempting auto-fix...');
        await this.attemptAutoFix();
      }

      return this.healthStatus;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      this.healthStatus = {
        isHealthy: false,
        workingEndpoints: 0,
        totalEndpoints: 0,
        lastCheck: new Date(),
        issues: ['Health check failed'],
        recommendations: ['Check internet connection', 'Restart application'],
      };

      this.notifyListeners();
      return this.healthStatus;
    }
  }

  /**
   * Attempt to auto-fix issues
   */
  public async attemptAutoFix(): Promise<boolean> {
    try {
      const result = await autoFixTidalIssues();
      
      if (result.success) {
        console.log('✅ Auto-fix successful:', result.actionsPerformed);
        // Perform another health check to update status
        await this.performHealthCheck();
        return true;
      } else {
        console.warn('⚠️ Auto-fix partially successful:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Auto-fix failed:', error);
      return false;
    }
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Subscribe to health status changes
   */
  public subscribe(listener: (status: HealthStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.healthStatus);
      } catch (error) {
        console.error('❌ Error notifying health status listener:', error);
      }
    });
  }

  /**
   * Force a connection test
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await testTidalApiConnection();
      return result.success;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  /**
   * Reset all endpoint health and retry
   */
  public async resetAndRetry(): Promise<boolean> {
    console.log('🔄 Resetting Tidal API health and retrying...');
    
    resetTidalEndpointHealth();
    
    // Wait a moment for reset to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.testConnection();
  }

  /**
   * Get detailed endpoint information
   */
  public async getDetailedStatus(): Promise<any> {
    return await runTidalDiagnostics();
  }
}

// Export singleton instance
export const tidalHealthMonitor = TidalHealthMonitor.getInstance();

// React hook for using health monitor in components
import { useState, useEffect } from 'react';

export function useTidalHealth() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(
    tidalHealthMonitor.getHealthStatus()
  );

  useEffect(() => {
    const unsubscribe = tidalHealthMonitor.subscribe(setHealthStatus);
    
    // Start monitoring if not already started
    tidalHealthMonitor.startMonitoring();
    
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    healthStatus,
    testConnection: () => tidalHealthMonitor.testConnection(),
    resetAndRetry: () => tidalHealthMonitor.resetAndRetry(),
    attemptAutoFix: () => tidalHealthMonitor.attemptAutoFix(),
    getDetailedStatus: () => tidalHealthMonitor.getDetailedStatus(),
  };
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).tidalHealthMonitor = tidalHealthMonitor;
  
  console.log('🔍 Tidal Health Monitor loaded!');
  console.log('Available via: window.tidalHealthMonitor');
  console.log('Methods: startMonitoring(), performHealthCheck(), attemptAutoFix()');
}