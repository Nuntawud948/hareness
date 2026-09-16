import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from '../../src/infrastructure/rate-limiter/memory-rate-limiter.js';

describe('MemoryRateLimiter', () => {
  it('should allow requests within limit and block when exceeded', async () => {
    const limiter = new MemoryRateLimiter(3, 10_000); // 3 requests per 10s
    const key = 'user:123';

    const res1 = await limiter.checkLimit(key);
    expect(res1.allowed).toBe(true);
    expect(res1.currentCount).toBe(1);

    const res2 = await limiter.checkLimit(key);
    expect(res2.allowed).toBe(true);
    expect(res2.currentCount).toBe(2);

    const res3 = await limiter.checkLimit(key);
    expect(res3.allowed).toBe(true);
    expect(res3.currentCount).toBe(3);

    // 4th request must be blocked
    const res4 = await limiter.checkLimit(key);
    expect(res4.allowed).toBe(false);
    expect(res4.currentCount).toBe(4);
    expect(res4.resetSeconds).toBeGreaterThan(0);

    // Reset should unblock
    await limiter.reset(key);
    const resAfterReset = await limiter.checkLimit(key);
    expect(resAfterReset.allowed).toBe(true);
    expect(resAfterReset.currentCount).toBe(1);
  });
});
