export interface RateLimiter {
  acquire(): Promise<void>;
  release(): void;
  waitForSlot(): Promise<() => void>;
}

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private lastRefill: number;
  private waiting: Array<{ resolve: () => void; reject: (err: Error) => void }>;
  private activeCount: number;
  private readonly maxConcurrency: number;
  private timer: ReturnType<typeof setInterval> | null;

  constructor(requestsPerSecond: number, burstSize: number = requestsPerSecond, maxConcurrency = 10) {
    this.maxTokens = burstSize;
    this.tokens = burstSize;
    this.refillRate = requestsPerSecond;
    this.refillInterval = 1000;
    this.lastRefill = Date.now();
    this.waiting = [];
    this.activeCount = 0;
    this.maxConcurrency = maxConcurrency;
    this.timer = null;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.refill(), this.refillInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.activeCount >= this.maxConcurrency) {
        this.waiting.push({ resolve, reject });
        return;
      }
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        this.activeCount += 1;
        resolve();
      } else {
        this.waiting.push({
          resolve: () => {
            this.tokens -= 1;
            this.activeCount += 1;
            resolve();
          },
          reject,
        });
      }
    });
  }

  release(): void {
    this.activeCount -= 1;
    if (this.activeCount < 0) this.activeCount = 0;
    this.processWaiting();
  }

  waitForSlot(): Promise<() => void> {
    return this.acquire().then(() => () => this.release());
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillInterval) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
    this.processWaiting();
  }

  private processWaiting(): void {
    while (this.waiting.length > 0 && this.tokens >= 1 && this.activeCount < this.maxConcurrency) {
      const next = this.waiting.shift();
      if (next) next.resolve();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getPendingCount(): number {
    return this.waiting.length;
  }

  dispose(): void {
    this.stop();
    this.waiting = [];
  }
}

export class NoopRateLimiter implements RateLimiter {
  async acquire(): Promise<void> {}
  release(): void {}
  async waitForSlot(): Promise<() => void> {
    return () => {};
  }
}
