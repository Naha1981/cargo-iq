/**
 * CargoIQ — In-Memory Sliding Window Rate Limiter
 *
 * Uses a Map<string, number[]> to track request timestamps per IP.
 * Implements a sliding window algorithm where each IP's request history
 * is stored as an array of timestamps within the window period.
 *
 * - Default: 60s window, 30 requests per minute
 * - Automatic cleanup of expired entries every 60 seconds
 * - Export singleton instance: rateLimiter
 * - Helper for Next.js: withRateLimit(request)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RateLimitOptions {
  /** Sliding window duration in milliseconds */
  windowMs?: number;
  /** Maximum number of requests allowed within the window */
  maxRequests?: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private defaultWindowMs: number;
  private defaultMaxRequests: number;

  constructor(
    defaultWindowMs: number = 60_000,
    defaultMaxRequests: number = 30
  ) {
    this.defaultWindowMs = defaultWindowMs;
    this.defaultMaxRequests = defaultMaxRequests;

    // Automatic cleanup every 60 seconds to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a request from the given IP is within rate limits.
   *
   * @param ip - The client IP address
   * @param options - Optional rate limit configuration overrides
   * @returns RateLimitResult with allowed status, remaining count, and reset time
   */
  checkRateLimit(
    ip: string,
    options?: RateLimitOptions
  ): RateLimitResult {
    const windowMs = options?.windowMs ?? this.defaultWindowMs;
    const maxRequests = options?.maxRequests ?? this.defaultMaxRequests;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this IP
    let timestamps = this.requests.get(ip) ?? [];

    // Filter out timestamps outside the current window (sliding window)
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const currentCount = timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount);

    if (currentCount >= maxRequests) {
      // Rate limit exceeded
      const oldestInWindow = timestamps[0] ?? now;
      const resetAt = oldestInWindow + windowMs;

      // Update the map with cleaned timestamps
      this.requests.set(ip, timestamps);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Request allowed — record the timestamp
    timestamps.push(now);
    this.requests.set(ip, timestamps);

    // Calculate reset time (oldest timestamp in window + window duration)
    const oldestInWindow = timestamps[0] ?? now;
    const resetAt = oldestInWindow + windowMs;

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      resetAt,
    };
  }

  /**
   * Remove expired entries from memory to prevent memory leaks.
   * Called automatically every 60 seconds.
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [ip, timestamps] of this.requests.entries()) {
      // Remove timestamps older than the default window
      const windowStart = now - this.defaultWindowMs;
      const filtered = timestamps.filter((ts) => ts > windowStart);

      if (filtered.length === 0) {
        // No recent requests — remove the IP entry entirely
        this.requests.delete(ip);
      } else if (filtered.length !== timestamps.length) {
        this.requests.set(ip, filtered);
      }
    }
  }

  /**
   * Reset rate limit for a specific IP (useful for testing or admin actions).
   */
  reset(ip: string): void {
    this.requests.delete(ip);
  }

  /**
   * Get the current number of tracked IPs (for monitoring).
   */
  get trackedIps(): number {
    return this.requests.size;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Next.js middleware helper for rate limiting.
 *
 * @param request - The incoming NextRequest
 * @param options - Optional rate limit configuration overrides
 * @returns null if the request is allowed, or a 429 NextResponse if rate limited
 */
export function withRateLimit(
  request: NextRequest,
  options?: RateLimitOptions
): NextResponse | null {
  // Extract client IP — prefer X-Forwarded-For, fall back to x-real-ip, then unknown
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  const result = rateLimiter.checkRateLimit(ip, options);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(
      (result.resetAt - Date.now()) / 1000
    );

    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, retryAfterSeconds)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  // Request is allowed — return null (no error response)
  return null;
}
