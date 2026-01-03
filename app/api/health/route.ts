/**
 * Health Check API Endpoint
 * Phase 6.2: Monitoring Setup
 * 
 * Provides database health status and metrics for monitoring
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { mongoMonitor } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    readyState: string;
    latency?: number;
  };
  metrics?: {
    queries: {
      totalQueries: number;
      averageDuration: number;
      slowQueries: number;
      failedQueries: number;
    };
    transactions: {
      total: number;
      committed: number;
      aborted: number;
      inProgress: number;
      averageDuration: number;
    };
  };
  uptime: number;
}

const startTime = Date.now();

function getReadyStateString(state: number): string {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString();
  const uptime = Date.now() - startTime;
  
  try {
    // Check database connection
    await dbConnect();
    
    const readyState = mongoose.connection.readyState;
    const isConnected = readyState === 1;
    
    // Measure database latency with a simple ping
    let latency: number | undefined;
    if (isConnected && mongoose.connection.db) {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      latency = Date.now() - pingStart;
    }
    
    // Get monitoring metrics
    const queryStats = mongoMonitor.getQueryStats();
    const transactionStats = mongoMonitor.getTransactionStats();
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!isConnected) {
      status = 'unhealthy';
    } else if (latency && latency > 100) {
      status = 'degraded';
    } else if (queryStats.failedQueries > 0 || transactionStats.aborted > 0) {
      status = 'degraded';
    }
    
    const response: HealthCheckResponse = {
      status,
      timestamp,
      database: {
        connected: isConnected,
        readyState: getReadyStateString(readyState),
        latency,
      },
      metrics: {
        queries: queryStats,
        transactions: transactionStats,
      },
      uptime,
    };
    
    const httpStatus = status === 'unhealthy' ? 503 : 200;
    return NextResponse.json(response, { status: httpStatus });
    
  } catch (error) {
    console.error('[Health Check] Error:', error);
    
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp,
      database: {
        connected: false,
        readyState: 'error',
      },
      uptime,
    };
    
    return NextResponse.json(response, { status: 503 });
  }
}
