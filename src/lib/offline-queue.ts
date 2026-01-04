'use client';

/**
 * Offline Action Queue
 * 
 * Queues actions when offline and processes them when back online.
 * Supports recording visits and submitting feedback.
 */

export type QueuedActionType = 'recordVisit' | 'submitFeedback' | 'submitOrganizationFeedback';

export interface QueuedAction {
  id: string;
  action: QueuedActionType;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface QueueStatus {
  pending: number;
  processing: boolean;
  lastProcessed: number | null;
}

type QueueEventListener = (status: QueueStatus) => void;

class OfflineQueue {
  private readonly STORAGE_KEY = 'career_city_offline_queue';
  private readonly MAX_RETRIES = 3;
  private processing = false;
  private listeners: Set<QueueEventListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Process queue when coming back online
      window.addEventListener('online', () => {
        console.log('[OfflineQueue] Back online, processing queue...');
        this.processQueue();
      });

      // Process any pending items on startup if online
      if (navigator.onLine) {
        // Delay to allow app to initialize
        setTimeout(() => this.processQueue(), 2000);
      }
    }
  }

  /**
   * Check if the browser is currently online
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  /**
   * Add an action to the queue
   */
  add(action: QueuedActionType, data: Record<string, unknown>): string {
    const id = this.generateId();
    const queuedAction: QueuedAction = {
      id,
      action,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    const queue = this.getQueue();
    queue.push(queuedAction);
    this.saveQueue(queue);
    this.notifyListeners();

    console.log(`[OfflineQueue] Action queued: ${action}`, { id, data });

    // Try to process immediately if online
    if (this.isOnline() && !this.processing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Get the current queue
   */
  getQueue(): QueuedAction[] {
    if (typeof localStorage === 'undefined') return [];
    
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      console.error('[OfflineQueue] Failed to load queue from storage');
      return [];
    }
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    const queue = this.getQueue();
    return {
      pending: queue.length,
      processing: this.processing,
      lastProcessed: queue.length > 0 ? Math.max(...queue.map(q => q.timestamp)) : null,
    };
  }

  /**
   * Subscribe to queue status changes
   */
  subscribe(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Process all queued actions
   */
  async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline()) {
      return;
    }

    this.processing = true;
    this.notifyListeners();

    const queue = this.getQueue();
    const remaining: QueuedAction[] = [];
    let processedCount = 0;

    for (const item of queue) {
      try {
        await this.executeAction(item);
        processedCount++;
        console.log(`[OfflineQueue] Successfully processed: ${item.action}`, item.id);
      } catch (error) {
        console.error(`[OfflineQueue] Failed to process: ${item.action}`, error);
        
        if (item.retries < this.MAX_RETRIES) {
          remaining.push({ ...item, retries: item.retries + 1 });
        } else {
          console.warn(`[OfflineQueue] Max retries reached, discarding: ${item.action}`, item.id);
        }
      }
    }

    this.saveQueue(remaining);
    this.processing = false;
    this.notifyListeners();

    if (processedCount > 0) {
      console.log(`[OfflineQueue] Processed ${processedCount} actions, ${remaining.length} remaining`);
    }
  }

  /**
   * Clear all queued actions
   */
  clear(): void {
    this.saveQueue([]);
    this.notifyListeners();
  }

  /**
   * Remove a specific action from the queue
   */
  remove(id: string): boolean {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.id !== id);
    
    if (filtered.length !== queue.length) {
      this.saveQueue(filtered);
      this.notifyListeners();
      return true;
    }
    
    return false;
  }

  private async executeAction(item: QueuedAction): Promise<void> {
    switch (item.action) {
      case 'recordVisit': {
        const { recordVisit } = await import('@/actions/scans');
        const { 
          studentId, 
          studentEmail,
          studentProgram,
          organizationId, 
          organizationName, 
          boothNumber 
        } = item.data as {
          studentId: string;
          studentEmail: string;
          studentProgram: string;
          organizationId: string;
          organizationName: string;
          boothNumber: string;
        };
        const result = await recordVisit(
          studentId, 
          studentEmail,
          studentProgram,
          organizationId, 
          organizationName, 
          boothNumber
        );
        if (!result.success) {
          throw new Error('Failed to record visit');
        }
        break;
      }

      case 'submitFeedback': {
        const { addStudentFeedback } = await import('@/actions/feedback');
        const { studentId, responses } = item.data as {
          studentId: string;
          responses: Record<string, string | number | string[]>;
        };
        await addStudentFeedback(studentId, responses);
        break;
      }

      case 'submitOrganizationFeedback': {
        const { addOrganizationFeedback } = await import('@/actions/feedback');
        const { organizationId, responses } = item.data as {
          organizationId: string;
          responses: Record<string, string | number | string[]>;
        };
        await addOrganizationFeedback(organizationId, responses);
        break;
      }

      default:
        throw new Error(`Unknown action type: ${item.action}`);
    }
  }

  private saveQueue(queue: QueuedAction[]): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue to storage', error);
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

/**
 * Hook to use the offline queue in React components
 */
export function useOfflineQueue() {
  if (typeof window === 'undefined') {
    return {
      isOnline: true,
      pendingCount: 0,
      processing: false,
      addToQueue: () => '',
      processQueue: async () => {},
    };
  }

  return {
    isOnline: offlineQueue.isOnline(),
    pendingCount: offlineQueue.getStatus().pending,
    processing: offlineQueue.getStatus().processing,
    addToQueue: (action: QueuedActionType, data: Record<string, unknown>) => 
      offlineQueue.add(action, data),
    processQueue: () => offlineQueue.processQueue(),
  };
}
