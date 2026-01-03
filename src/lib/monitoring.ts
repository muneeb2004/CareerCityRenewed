/**
 * MongoDB Performance Monitoring Utilities
 * Phase 6.2: Monitoring Setup
 * 
 * Provides connection pool monitoring, query timing, and transaction failure alerts
 */

import mongoose from 'mongoose';

interface ConnectionPoolStats {
  totalConnections: number;
  availableConnections: number;
  pendingConnections: number;
}

interface QueryMetrics {
  operation: string;
  collection: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

interface TransactionMetrics {
  transactionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'started' | 'committed' | 'aborted';
  operations: string[];
  error?: string;
}

interface AlertConfig {
  queryThresholdMs: number;
  transactionThresholdMs: number;
  connectionPoolWarningThreshold: number;
  onSlowQuery?: (metrics: QueryMetrics) => void;
  onTransactionFailure?: (metrics: TransactionMetrics) => void;
  onConnectionPoolWarning?: (stats: ConnectionPoolStats) => void;
}

class MongoDBMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private transactionMetrics: Map<string, TransactionMetrics> = new Map();
  private alertConfig: AlertConfig;
  private isEnabled: boolean = false;

  constructor(config?: Partial<AlertConfig>) {
    this.alertConfig = {
      queryThresholdMs: config?.queryThresholdMs ?? 100,
      transactionThresholdMs: config?.transactionThresholdMs ?? 500,
      connectionPoolWarningThreshold: config?.connectionPoolWarningThreshold ?? 0.8,
      onSlowQuery: config?.onSlowQuery ?? this.defaultSlowQueryHandler,
      onTransactionFailure: config?.onTransactionFailure ?? this.defaultTransactionFailureHandler,
      onConnectionPoolWarning: config?.onConnectionPoolWarning ?? this.defaultConnectionPoolWarningHandler,
    };
  }

  /**
   * Enable monitoring
   */
  enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.setupQueryMonitoring();
    console.log('[MongoDB Monitor] Monitoring enabled');
  }

  /**
   * Disable monitoring
   */
  disable(): void {
    this.isEnabled = false;
    console.log('[MongoDB Monitor] Monitoring disabled');
  }

  /**
   * Setup query monitoring using mongoose debug mode
   */
  private setupQueryMonitoring(): void {
    mongoose.set('debug', (collectionName: string, methodName: string, ...methodArgs: unknown[]) => {
      if (!this.isEnabled) return;
      
      const startTime = Date.now();
      
      // Log the operation
      console.log(`[MongoDB] ${collectionName}.${methodName}`, JSON.stringify(methodArgs).slice(0, 200));
      
      // Track query metrics
      this.trackQuery(collectionName, methodName, startTime);
    });
  }

  /**
   * Track a query execution
   */
  private trackQuery(collection: string, operation: string, startTime: number): void {
    const duration = Date.now() - startTime;
    
    const metrics: QueryMetrics = {
      operation,
      collection,
      duration,
      timestamp: new Date(),
      success: true,
    };

    this.queryMetrics.push(metrics);

    // Check for slow queries
    if (duration > this.alertConfig.queryThresholdMs) {
      this.alertConfig.onSlowQuery?.(metrics);
    }

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
  }

  /**
   * Record a query with explicit timing
   */
  recordQuery(options: {
    collection: string;
    operation: string;
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    const metrics: QueryMetrics = {
      ...options,
      timestamp: new Date(),
    };

    this.queryMetrics.push(metrics);

    if (options.duration > this.alertConfig.queryThresholdMs) {
      this.alertConfig.onSlowQuery?.(metrics);
    }
  }

  /**
   * Start tracking a transaction
   */
  startTransaction(transactionId: string): void {
    this.transactionMetrics.set(transactionId, {
      transactionId,
      startTime: new Date(),
      status: 'started',
      operations: [],
    });
  }

  /**
   * Add an operation to a transaction
   */
  addTransactionOperation(transactionId: string, operation: string): void {
    const metrics = this.transactionMetrics.get(transactionId);
    if (metrics) {
      metrics.operations.push(operation);
    }
  }

  /**
   * Complete a transaction successfully
   */
  commitTransaction(transactionId: string): void {
    const metrics = this.transactionMetrics.get(transactionId);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.status = 'committed';

      const duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      if (duration > this.alertConfig.transactionThresholdMs) {
        console.warn(`[MongoDB Monitor] Slow transaction ${transactionId}: ${duration}ms`);
      }
    }
  }

  /**
   * Abort a transaction
   */
  abortTransaction(transactionId: string, error?: string): void {
    const metrics = this.transactionMetrics.get(transactionId);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.status = 'aborted';
      metrics.error = error;
      
      this.alertConfig.onTransactionFailure?.(metrics);
    }
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionPoolStats(): Promise<ConnectionPoolStats | null> {
    try {
      const connection = mongoose.connection;
      if (!connection || connection.readyState !== 1) {
        return null;
      }

      const db = connection.db;
      if (!db) return null;

      const serverStatus = await db.admin().serverStatus();
      const connections = serverStatus.connections || {};

      const stats: ConnectionPoolStats = {
        totalConnections: connections.current || 0,
        availableConnections: connections.available || 0,
        pendingConnections: 0, // Not directly available, would need pool monitoring
      };

      // Check if pool is near capacity
      const usageRatio = stats.totalConnections / (stats.totalConnections + stats.availableConnections);
      if (usageRatio > this.alertConfig.connectionPoolWarningThreshold) {
        this.alertConfig.onConnectionPoolWarning?.(stats);
      }

      return stats;
    } catch (error) {
      console.error('[MongoDB Monitor] Failed to get connection pool stats:', error);
      return null;
    }
  }

  /**
   * Get query statistics summary
   */
  getQueryStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    failedQueries: number;
    operationBreakdown: Record<string, number>;
  } {
    const totalQueries = this.queryMetrics.length;
    const slowQueries = this.queryMetrics.filter(
      m => m.duration > this.alertConfig.queryThresholdMs
    ).length;
    const failedQueries = this.queryMetrics.filter(m => !m.success).length;
    
    const totalDuration = this.queryMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;

    const operationBreakdown: Record<string, number> = {};
    this.queryMetrics.forEach(m => {
      operationBreakdown[m.operation] = (operationBreakdown[m.operation] || 0) + 1;
    });

    return {
      totalQueries,
      averageDuration,
      slowQueries,
      failedQueries,
      operationBreakdown,
    };
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(): {
    total: number;
    committed: number;
    aborted: number;
    inProgress: number;
    averageDuration: number;
  } {
    const transactions = Array.from(this.transactionMetrics.values());
    const committed = transactions.filter(t => t.status === 'committed');
    const aborted = transactions.filter(t => t.status === 'aborted');
    const inProgress = transactions.filter(t => t.status === 'started');

    const completedTransactions = [...committed, ...aborted].filter(t => t.endTime);
    const totalDuration = completedTransactions.reduce(
      (sum, t) => sum + (t.endTime!.getTime() - t.startTime.getTime()),
      0
    );
    const averageDuration = completedTransactions.length > 0 
      ? totalDuration / completedTransactions.length 
      : 0;

    return {
      total: transactions.length,
      committed: committed.length,
      aborted: aborted.length,
      inProgress: inProgress.length,
      averageDuration,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.queryMetrics = [];
    this.transactionMetrics.clear();
  }

  /**
   * Get recent failed transactions
   */
  getRecentFailures(limit: number = 10): TransactionMetrics[] {
    return Array.from(this.transactionMetrics.values())
      .filter(t => t.status === 'aborted')
      .slice(-limit);
  }

  // Default handlers
  private defaultSlowQueryHandler(metrics: QueryMetrics): void {
    console.warn(
      `[MongoDB Monitor] Slow query detected: ${metrics.collection}.${metrics.operation} took ${metrics.duration}ms`
    );
  }

  private defaultTransactionFailureHandler(metrics: TransactionMetrics): void {
    console.error(
      `[MongoDB Monitor] Transaction failed: ${metrics.transactionId}`,
      `Operations: ${metrics.operations.join(', ')}`,
      `Error: ${metrics.error}`
    );
  }

  private defaultConnectionPoolWarningHandler(stats: ConnectionPoolStats): void {
    console.warn(
      `[MongoDB Monitor] Connection pool warning: ${stats.totalConnections}/${stats.totalConnections + stats.availableConnections} connections in use`
    );
  }
}

// Singleton instance
export const mongoMonitor = new MongoDBMonitor();

/**
 * Wrapper for monitoring database operations
 */
export async function withMonitoring<T>(
  collection: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let error: string | undefined;

  try {
    return await fn();
  } catch (e) {
    success = false;
    error = e instanceof Error ? e.message : 'Unknown error';
    throw e;
  } finally {
    mongoMonitor.recordQuery({
      collection,
      operation,
      duration: Date.now() - startTime,
      success,
      error,
    });
  }
}

/**
 * Wrapper for monitoring transactions
 */
export async function withTransactionMonitoring<T>(
  transactionId: string,
  fn: () => Promise<T>
): Promise<T> {
  mongoMonitor.startTransaction(transactionId);

  try {
    const result = await fn();
    mongoMonitor.commitTransaction(transactionId);
    return result;
  } catch (e) {
    mongoMonitor.abortTransaction(
      transactionId,
      e instanceof Error ? e.message : 'Unknown error'
    );
    throw e;
  }
}

export default MongoDBMonitor;
