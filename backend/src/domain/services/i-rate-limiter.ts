export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  resetSeconds: number;
}

export interface IRateLimiter {
  checkLimit(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}
