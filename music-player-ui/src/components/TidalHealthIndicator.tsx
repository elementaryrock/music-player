/**
 * Tidal Health Indicator Component
 * 
 * Displays the current health status of Tidal API endpoints
 */

import React from 'react';
import { useTidalHealth } from '../utils/tidalHealthMonitor';

interface TidalHealthIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

const TidalHealthIndicator: React.FC<TidalHealthIndicatorProps> = ({
  showDetails = false,
  className = '',
}) => {
  const { healthStatus, testConnection, resetAndRetry, attemptAutoFix } = useTidalHealth();

  const getStatusColor = () => {
    if (healthStatus.isHealthy) return '#4ade80'; // green
    if (healthStatus.workingEndpoints > 0) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  const getStatusText = () => {
    if (healthStatus.isHealthy) return 'Healthy';
    if (healthStatus.workingEndpoints > 0) return 'Degraded';
    return 'Offline';
  };

  const getStatusIcon = () => {
    if (healthStatus.isHealthy) return '✅';
    if (healthStatus.workingEndpoints > 0) return '⚠️';
    return '❌';
  };

  const handleTestConnection = async () => {
    console.log('🔍 Testing Tidal connection...');
    const success = await testConnection();
    console.log(success ? '✅ Connection test successful' : '❌ Connection test failed');
  };

  const handleResetAndRetry = async () => {
    console.log('🔄 Resetting and retrying...');
    const success = await resetAndRetry();
    console.log(success ? '✅ Reset successful' : '❌ Reset failed');
  };

  const handleAutoFix = async () => {
    console.log('🔧 Attempting auto-fix...');
    const success = await attemptAutoFix();
    console.log(success ? '✅ Auto-fix successful' : '❌ Auto-fix failed');
  };

  return (
    <div className={`tidal-health-indicator ${className}`}>
      <div 
        className="health-status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${getStatusColor()}`,
          fontSize: '14px',
          color: '#ffffff',
        }}
      >
        <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
        <span>Tidal: {getStatusText()}</span>
        <span style={{ 
          fontSize: '12px', 
          opacity: 0.8,
          marginLeft: '4px'
        }}>
          ({healthStatus.workingEndpoints}/{healthStatus.totalEndpoints})
        </span>
      </div>

      {showDetails && (
        <div 
          className="health-details"
          style={{
            marginTop: '8px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            fontSize: '12px',
            color: '#ffffff',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <strong>Current Endpoint:</strong> {healthStatus.currentEndpoint || 'None'}
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Last Check:</strong> {healthStatus.lastCheck.toLocaleTimeString()}
          </div>

          {healthStatus.issues.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Issues:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {healthStatus.issues.map((issue, index) => (
                  <li key={index} style={{ color: '#fbbf24' }}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {healthStatus.recommendations.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Recommendations:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {healthStatus.recommendations.map((rec, index) => (
                  <li key={index} style={{ color: '#60a5fa' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            flexWrap: 'wrap',
            marginTop: '12px'
          }}>
            <button
              onClick={handleTestConnection}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.2)',
                color: '#60a5fa',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.2)';
              }}
            >
              Test Connection
            </button>

            <button
              onClick={handleResetAndRetry}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                color: '#fbbf24',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.2)';
              }}
            >
              Reset & Retry
            </button>

            <button
              onClick={handleAutoFix}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.2)',
                color: '#4ade80',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
              }}
            >
              Auto-Fix
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TidalHealthIndicator;