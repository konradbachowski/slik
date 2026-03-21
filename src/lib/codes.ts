import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";
import crypto from 'crypto';


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
  set(key: string, value: unknown, options?: SetOptions): Promise<boolean | void>;
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
        const redisOptions: any = {
          ex: options.ex,
        };

        // Both nx and xx are optional but only one can be set at a given time
        if (options && "nx" in options) redisOptions.nx = true;
        if (options && "xx" in options) redisOptions.xx = true;

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
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);

  // Modulo bias is negligible here: 2^32 / 1_000_000 = 4294.967…
  // meaning values 0–999999 are extremely uniform
  const code = array[0] % 1_000_000;

  return code.toString().padStart(6, '0');
}

/**
 * Create a payment code for a given wallet.
 * Stores `code:<digits>` in Redis with a 120s TTL.
 *
 * Returns the 6-digit code string.
 */
export async function createPaymentCode(walletPubkey: string): Promise<string> {
  while (true) {
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

