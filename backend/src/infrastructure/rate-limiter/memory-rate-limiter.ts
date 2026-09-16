import { IRateLimiter, RateLimitResult } from '../../domain/services/i-rate-limiter.js';

interface RateEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements IRateLimiter {
  private readonly store = new Map<string, RateEntry>();
  private readonly maxLimit: number;
  private readonly windowMs: number;

  constructor(maxPerMinute = 10, windowMs = 60_000) {
    this.maxLimit = maxPerMinute;
    this.windowMs = windowMs;

    // Periodic cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60_000).unref();
  }

  async checkLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        currentCount: 1,
        maxLimit: this.maxLimit,
        resetSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    entry.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > this.maxLimit) {
      return {
        allowed: false,
        currentCount: entry.count,
        maxLimit: this.maxLimit,
        resetSeconds,
      };
    }

    return {
      allowed: true,
      currentCount: entry.count,
      maxLimit: this.maxLimit,
      resetSeconds,
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}
