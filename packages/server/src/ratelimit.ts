import type { Store } from "./storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitRule {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

// ---------------------------------------------------------------------------
// Core rate-limit check (fixed-window counter)
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a given identifier (e.g., IP address).
 * Uses an atomic fixed-window counter stored in the Store.
 */
export async function checkRateLimit(
  store: Store,
  identifier: string,
  route: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const windowStart =
    Math.floor(Date.now() / 1000 / rule.windowSeconds) * rule.windowSeconds;
  const key = `rl:${route}:${identifier}:${windowStart}`;

  const count = await store.incr(key, rule.windowSeconds + 1);

  const resetInSeconds =
    windowStart + rule.windowSeconds - Math.floor(Date.now() / 1000);

  if (count > rule.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(resetInSeconds, 1),
    };
  }

  return {
    allowed: true,
    remaining: rule.maxRequests - count,
    resetInSeconds: Math.max(resetInSeconds, 1),
  };
}

// ---------------------------------------------------------------------------
// Default rate limit rules per route pattern
// ---------------------------------------------------------------------------

/** Default rate limit rules per route pattern */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitRule> = {
  "codes/generate": { maxRequests: 5, windowSeconds: 60 },
  "codes/resolve": { maxRequests: 30, windowSeconds: 60 },
  "codes/resolve:burst": { maxRequests: 100, windowSeconds: 10 }, // anti brute-force (per-IP)
  "codes/resolve:global": { maxRequests: 500, windowSeconds: 10 }, // anti distributed brute-force (all IPs combined)
  "payments/create": { maxRequests: 10, windowSeconds: 60 },
  "payments/link": { maxRequests: 10, windowSeconds: 60 },
  "payments/status": { maxRequests: 30, windowSeconds: 60 },
  pay: { maxRequests: 5, windowSeconds: 60 },
  price: { maxRequests: 30, windowSeconds: 60 },
};
