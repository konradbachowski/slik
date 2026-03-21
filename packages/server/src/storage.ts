import type { CodeData, PaymentData } from "./types";
import { randomInt } from "node:crypto";

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

const CODE_TTL = 120; // 2 minutes
const PAYMENT_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------
type SetOptions =
  | { ex: number; nx: true; xx?: never }
  | { ex: number; xx: true; nx?: never }
  | { ex: number };
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options: SetOptions): Promise<boolean | void>;
  del(key: string): Promise<void>;
  /**
   * Atomic compare-and-set: read current value, check if `matchField` equals `matchValue`,
   * if yes -> merge `updates` into current value and set with TTL. Returns true if updated.
   */
  setIfMatch(
    key: string,
    matchField: string,
    matchValue: unknown,
    updates: Record<string, unknown>,
    ttlSeconds: number
  ): Promise<boolean>;
  /** Atomic increment. Returns the new value. Creates key with value 1 if it doesn't exist. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// Upstash Redis adapter
// ---------------------------------------------------------------------------

export function createUpstashStore(config: {
  url: string;
  token: string;
}): Store {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redisInstance: any = null;

  async function getRedis() {
    if (!redisInstance) {
      const { Redis } = await import("@upstash/redis");
      redisInstance = new Redis({ url: config.url, token: config.token });
    }
    return redisInstance;
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      const redis = await getRedis();
      const data = await redis.get(key);
      return (data as T) ?? null;
    },
    async set(key: string, value: unknown, options: SetOptions): Promise<boolean | void> {
      const redis = await getRedis();

      let redisOptions: SetOptions;

      // Both nx and xx are optional but only one can be set at a given time
      if ("nx" in options) {
        redisOptions = { ex: options.ex, nx: true };
      } 
      else if ("xx" in options) {
        redisOptions = { ex: options.ex, xx: true };
      } 
      else {
        redisOptions = { ex: options.ex };
      }

      const result = await redis.set(key, value, redisOptions);

      // Redis returns "OK" when set() ends with a succes
      return result === 'OK';
    },
    async del(key: string): Promise<void> {
      const redis = await getRedis();
      await redis.del(key);
    },
    async setIfMatch(
      key: string,
      matchField: string,
      matchValue: unknown,
      updates: Record<string, unknown>,
      ttlSeconds: number
    ): Promise<boolean> {
      const redis = await getRedis();
      const luaScript = `
        local current = redis.call('GET', KEYS[1])
        if not current then return 0 end
        local data = cjson.decode(current)
        if tostring(data[ARGV[1]]) ~= ARGV[2] then return 0 end
        for k, v in pairs(cjson.decode(ARGV[3])) do
          data[k] = v
        end
        redis.call('SET', KEYS[1], cjson.encode(data), 'EX', tonumber(ARGV[4]))
        return 1
      `;
      const result = await redis.eval(
        luaScript,
        [key],
        [matchField, String(matchValue), JSON.stringify(updates), String(ttlSeconds)]
      );
      return result === 1;
    },
    async incr(key: string, ttlSeconds: number): Promise<number> {
      const redis = await getRedis();
      // INCR is atomic in Redis. If key doesn't exist, it's set to 0 then incremented to 1.
      const count = await redis.incr(key);
      // Set TTL only on first increment (when count === 1)
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory adapter (dev/testing only)
// ---------------------------------------------------------------------------

export function createMemoryStore(): Store {
  const data = new Map<string, { value: unknown; expiresAt: number }>();

  function prune(key: string) {
    const entry = data.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      data.delete(key);
      return true;
    }
    return false;
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      prune(key);
      const entry = data.get(key);
      return entry ? (entry.value as T) : null;
    },
    async set(key: string, value: unknown, options: SetOptions): Promise<void> {
      data.set(key, {
        value,
        expiresAt: Date.now() + options.ex * 1000,
      });
    },
    async del(key: string): Promise<void> {
      data.delete(key);
    },
    async setIfMatch(
      key: string,
      matchField: string,
      matchValue: unknown,
      updates: Record<string, unknown>,
      ttlSeconds: number
    ): Promise<boolean> {
      prune(key);
      const entry = data.get(key);
      if (!entry) return false;
      const current = entry.value as Record<string, unknown>;
      if (String(current[matchField]) !== String(matchValue)) return false;
      const updated = { ...current, ...updates };
      data.set(key, {
        value: updated,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return true;
    },
    async incr(key: string, ttlSeconds: number): Promise<number> {
      prune(key);
      const entry = data.get(key);
      const newCount = entry ? (entry.value as number) + 1 : 1;
      data.set(key, {
        value: newCount,
        expiresAt: entry ? entry.expiresAt : Date.now() + ttlSeconds * 1000,
      });
      return newCount;
    },
  };
}

// ---------------------------------------------------------------------------
// Code generation (crypto-secure)
// ---------------------------------------------------------------------------

/** Generate a random 6-digit numeric string (000000 - 999999). */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Code CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a payment code for a given wallet.
 * Stores `code:<digits>` in the store with a 120s TTL.
 * Returns the 6-digit code string.
 */
export async function createPaymentCode(
  store: Store,
  walletPubkey: string
): Promise<string> {
  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateCode();
  
    const data: CodeData = {
      walletPubkey,
      createdAt: Date.now(),
    };
  
    const success = await store.set(
      `code:${code}`, 
      data, 
      {ex: CODE_TTL, nx: true}
    );
  
    if (success) {
      return code;
    }
  }

  throw new Error(`Failed to generate unique payment code after ${MAX_RETRIES}`);
}

/**
 * Resolve a 6-digit code to its stored data.
 * Returns null if the code does not exist or has expired.
 */
export async function resolveCode(
  store: Store,
  code: string
): Promise<CodeData | null> {
  return store.get<CodeData>(`code:${code}`);
}

/**
 * Link a code to a payment by updating the code record with the paymentId.
 */
export async function linkCodeToPayment(
  store: Store,
  code: string,
  paymentId: string
): Promise<void> {
  const existing = await resolveCode(store, code);
  if (!existing) {
    throw new Error("Code not found or expired");
  }

  const updated: CodeData = {
    ...existing,
    paymentId,
  };

  // Re-set with remaining TTL approximation (keep original TTL window)
  const elapsed = Math.floor((Date.now() - existing.createdAt) / 1000);
  const remainingTtl = Math.max(CODE_TTL - elapsed, 1);

  await store.set(`code:${code}`, updated, {ex: remainingTtl});
}

// ---------------------------------------------------------------------------
// Payment CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a new payment record.
 * Returns the generated paymentId (UUID v4).
 */
export async function createPayment(
  store: Store,
  amount: number,
  merchantWallet: string,
  currency: "SOL" | "USDC" = "SOL"
): Promise<string> {
  const paymentId = crypto.randomUUID();

  const data: PaymentData = {
    amount,
    currency,
    merchantWallet,
    status: "awaiting_code",
    createdAt: Date.now(),
  };

  await store.set(`payment:${paymentId}`, data, {ex: PAYMENT_TTL});

  return paymentId;
}

/**
 * Get payment data by ID.
 * Returns null if the payment does not exist or has expired.
 */
export async function getPayment(
  store: Store,
  paymentId: string
): Promise<PaymentData | null> {
  return store.get<PaymentData>(`payment:${paymentId}`);
}

/**
 * Update a payment record. Preserves existing TTL window.
 */
export async function updatePayment(
  store: Store,
  paymentId: string,
  updates: Partial<PaymentData>
): Promise<void> {
  const existing = await getPayment(store, paymentId);
  if (!existing) {
    throw new Error("Payment not found or expired");
  }

  const updated: PaymentData = { ...existing, ...updates };

  const elapsed = Math.floor((Date.now() - existing.createdAt) / 1000);
  const remainingTtl = Math.max(PAYMENT_TTL - elapsed, 1);

  await store.set(`payment:${paymentId}`, updated, {ex: remainingTtl});
}

/**
 * Atomically link a payment - only succeeds if payment status is "awaiting_code".
 * Prevents race condition where two merchants link the same code.
 */
export async function atomicLinkPayment(
  store: Store,
  paymentId: string,
  updates: Partial<PaymentData>
): Promise<boolean> {
  const existing = await getPayment(store, paymentId);
  if (!existing) return false;

  const elapsed = Math.floor((Date.now() - existing.createdAt) / 1000);
  const remainingTtl = Math.max(PAYMENT_TTL - elapsed, 1);

  const merged = { ...existing, ...updates };
  return store.setIfMatch(
    `payment:${paymentId}`,
    "status",
    "awaiting_code",
    merged as unknown as Record<string, unknown>,
    remainingTtl
  );
}

// ---------------------------------------------------------------------------
// Reference mapping helpers
// ---------------------------------------------------------------------------

/**
 * Store a mapping from a reference (receipt PDA base58) to a paymentId.
 * Used for reverse-lookup when confirming on-chain payments.
 */
export async function setReferenceMapping(
  store: Store,
  reference: string,
  paymentId: string
): Promise<void> {
  await store.set(`ref:${reference}`, paymentId, {ex: PAYMENT_TTL});
}

/**
 * Look up a paymentId by its reference (receipt PDA base58).
 */
export async function getPaymentByReference(
  store: Store,
  reference: string
): Promise<string | null> {
  return store.get<string>(`ref:${reference}`);
}
