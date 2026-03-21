import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeData {
  walletPubkey: string;
  paymentId?: string;
  createdAt: number;
}

export type PaymentStatus = "awaiting_code" | "linked" | "paid" | "expired";

export interface PaymentData {
  amount: number;
  status: PaymentStatus;
  merchantWallet: string;
  code?: string;
  reference?: string;
  walletPubkey?: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

const CODE_TTL = 120; // 2 minutes
const PAYMENT_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Storage abstraction: Redis or in-memory fallback
// ---------------------------------------------------------------------------

type SetOptions =
  | { ex: number; nx: true; xx?: never }
  | { ex: number; xx: true; nx?: never }
  | { ex: number };
interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options: SetOptions): Promise<boolean | void>;
  del(key: string): Promise<void>;
}

function createRedisStore(): Store {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    async get<T>(key: string): Promise<T | null> {
      const data = await redis.get<T>(key);
      return data ?? null;
    },
    async set(key: string, value: unknown, options: SetOptions): Promise<boolean | void> {
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
      await redis.del(key);
    },
  };
}

function createMemoryStore(): Store {
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
        expiresAt: Date.now() + options.ex * 1000
      });
    },
    async del(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const store: Store = hasRedis ? createRedisStore() : createMemoryStore();

if (!hasRedis) {
  console.warn(
    "[slik] UPSTASH_REDIS_REST_URL / TOKEN not set - using in-memory store (dev only)"
  );
}

// ---------------------------------------------------------------------------
// Code helpers
// ---------------------------------------------------------------------------

/** Generate a cryptographically secure random 6-digit code string (000000–999999).
 *  Always returns exactly 6 characters.
 */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Create a payment code for a given wallet.
 * Stores `code:<digits>` in Redis with a 120s TTL.
 *
 * Returns the 6-digit code string.
 */
export async function createPaymentCode(walletPubkey: string): Promise<string> {
  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateCode();
  
    const data: CodeData = {
      walletPubkey,
      createdAt: Date.now()
    };

    // dev
    if (!hasRedis) {
      await store.set(
        `code:${code}`, 
        data, 
        {ex: CODE_TTL}
      );

      return code;
    }
  
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
export async function resolveCode(code: string): Promise<CodeData | null> {
  return store.get<CodeData>(`code:${code}`);
}

/**
 * Link a code to a payment by updating the code record with the paymentId.
 */
export async function linkCodeToPayment(
  code: string,
  paymentId: string
): Promise<void> {
  const existing = await resolveCode(code);
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
// Payment helpers
// ---------------------------------------------------------------------------

/**
 * Create a new payment record.
 * Returns the generated paymentId (UUID).
 */
export async function createPayment(amount: number, merchantWallet: string): Promise<string> {
  const paymentId = uuidv4();

  const data: PaymentData = {
    amount,
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
  paymentId: string
): Promise<PaymentData | null> {
  return store.get<PaymentData>(`payment:${paymentId}`);
}

/**
 * Update a payment record. Preserves existing TTL window.
 */
export async function updatePayment(
  paymentId: string,
  updates: Partial<PaymentData>
): Promise<void> {
  const existing = await getPayment(paymentId);
  if (!existing) {
    throw new Error("Payment not found or expired");
  }

  const updated: PaymentData = { ...existing, ...updates };

  const elapsed = Math.floor((Date.now() - existing.createdAt) / 1000);
  const remainingTtl = Math.max(PAYMENT_TTL - elapsed, 1);

  await store.set(`payment:${paymentId}`, updated, {ex: remainingTtl});
}

