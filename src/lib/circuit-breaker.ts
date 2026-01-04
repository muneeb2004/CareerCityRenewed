export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailure;
      if (timeSinceLastFailure < this.timeout) {
        return true;
      }
      // Half-open: allow retry after timeout
      this.failures = 0; 
    }
    return false;
  }

  async execute<T>(fn: () => Promise<T>, shouldCountError: (err: any) => boolean = () => true): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Service temporarily unavailable (Circuit Open)');
    }

    try {
      const result = await fn();
      this.failures = 0; // Success resets failures
      return result;
    } catch (error) {
      if (shouldCountError(error)) {
        this.failures++;
        this.lastFailure = Date.now();
      }
      throw error;
    }
  }
}

export const dbBreaker = new CircuitBreaker();
