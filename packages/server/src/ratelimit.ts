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
 * Uses a simple fixed-window counter stored in the Store.
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

  const current = await store.get<number>(key);
  const count = (current ?? 0) + 1;

  if (count > rule.maxRequests) {
    const resetInSeconds =
      windowStart + rule.windowSeconds - Math.floor(Date.now() / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(resetInSeconds, 1),
    };
  }

  await store.set(key, count, rule.windowSeconds + 1); // +1s buffer for clock drift

  return {
    allowed: true,
    remaining: rule.maxRequests - count,
    resetInSeconds:
      windowStart + rule.windowSeconds - Math.floor(Date.now() / 1000),
  };
}

// ---------------------------------------------------------------------------
// Default rate limit rules per route pattern
// ---------------------------------------------------------------------------

/** Default rate limit rules per route pattern */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitRule> = {
  "codes/generate": { maxRequests: 5, windowSeconds: 60 },
  "codes/resolve": { maxRequests: 30, windowSeconds: 60 },
  "codes/resolve:burst": { maxRequests: 100, windowSeconds: 10 }, // anti brute-force
  "payments/create": { maxRequests: 10, windowSeconds: 60 },
  "payments/link": { maxRequests: 10, windowSeconds: 60 },
  "payments/status": { maxRequests: 30, windowSeconds: 60 },
  pay: { maxRequests: 5, windowSeconds: 60 },
  price: { maxRequests: 30, windowSeconds: 60 },
};
