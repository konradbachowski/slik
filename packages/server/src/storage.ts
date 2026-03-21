import type { CodeData, PaymentData } from "./types";

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

const CODE_TTL = 120; // 2 minutes
const PAYMENT_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
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
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      const redis = await getRedis();
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async del(key: string): Promise<void> {
      const redis = await getRedis();
      await redis.del(key);
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
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      data.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
    async del(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Code generation (crypto-secure)
// ---------------------------------------------------------------------------

/** Generate a random 6-digit numeric string (100000 - 999999). */
export function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return code.toString();
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
  const code = generateCode();

  const data: CodeData = {
    walletPubkey,
    createdAt: Date.now(),
  };

  await store.set(`code:${code}`, data, CODE_TTL);

  return code;
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

  await store.set(`code:${code}`, updated, remainingTtl);
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
  merchantWallet: string
): Promise<string> {
  const paymentId = crypto.randomUUID();

  const data: PaymentData = {
    amount,
    merchantWallet,
    status: "awaiting_code",
    createdAt: Date.now(),
  };

  await store.set(`payment:${paymentId}`, data, PAYMENT_TTL);

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

  await store.set(`payment:${paymentId}`, updated, remainingTtl);
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
  await store.set(`ref:${reference}`, paymentId, PAYMENT_TTL);
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
