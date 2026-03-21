import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createPayTransaction,
  createPayUsdcTransaction,
  deriveReceiptPda,
} from "@slik-pay/sdk";
import { eq } from "drizzle-orm";
import type { Store } from "./storage";
import {
  createPaymentCode,
  resolveCode,
  createPayment,
  getPayment,
  updatePayment,
  linkCodeToPayment,
  setReferenceMapping,
  atomicLinkPayment,
} from "./storage";
import type { Db } from "./db";
import { schema } from "./db";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class SlikError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "SlikError";
  }
}

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

export interface HandlerContext {
  store: Store;
  connection: Connection;
  db?: Db; // Optional - if not set, merchant features disabled
}

// ---------------------------------------------------------------------------
// POST /codes/generate
// ---------------------------------------------------------------------------

export async function handleGenerateCode(
  ctx: HandlerContext,
  input: { walletPubkey: string }
): Promise<{ code: string; expiresIn: number }> {
  const { walletPubkey } = input;

  if (!walletPubkey || typeof walletPubkey !== "string") {
    throw new SlikError("Missing or invalid walletPubkey.", 400);
  }

  // Validate that it's a legit Solana public key
  try {
    new PublicKey(walletPubkey);
  } catch {
    throw new SlikError("Invalid Solana public key.", 400);
  }

  let code = "";
  try {
    code = await createPaymentCode(ctx.store, walletPubkey);
  } catch (err) {
    throw new SlikError("Failed to generate a unique code. Please try again.", 503);
  }

  return { code, expiresIn: 120 };
}

// ---------------------------------------------------------------------------
// GET /codes/:code/resolve
// ---------------------------------------------------------------------------

export async function handleResolveCode(
  ctx: HandlerContext,
  input: { code: string; wallet?: string }
): Promise<{
  status: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  merchantName?: string;
  merchantLogo?: string | null;
}> {
  const { code, wallet } = input;

  if (!code || !/^\d{6}$/.test(code)) {
    throw new SlikError("Invalid code format. Must be 6 digits.", 400);
  }

  if (!wallet || typeof wallet !== "string") {
    throw new SlikError("Missing wallet parameter.", 400);
  }

  const codeData = await resolveCode(ctx.store, code);

  // Return same 404 whether code doesn't exist or wallet doesn't match
  // (prevents information leakage about which codes are active)
  if (!codeData || codeData.walletPubkey !== wallet) {
    throw new SlikError("Code not found or expired.", 404);
  }

  // Code exists but hasn't been linked to a payment yet
  if (!codeData.paymentId) {
    return { status: "waiting" };
  }

  // Code is linked to a payment - fetch payment details
  const payment = await getPayment(ctx.store, codeData.paymentId);

  if (!payment) {
    return { status: "waiting" };
  }

  // Lookup merchant info (returns null if db not configured or merchant not found)
  const merchantInfo = await lookupMerchant(ctx, payment.merchantWallet);

  if (payment.status === "paid") {
    return {
      status: "paid",
      paymentId: codeData.paymentId,
      amount: payment.amount,
      currency: payment.currency ?? "SOL",
      merchantName: merchantInfo?.name,
      merchantLogo: merchantInfo?.logoUrl,
    };
  }

  // Payment exists and is linked
  return {
    status: "linked",
    paymentId: codeData.paymentId,
    currency: payment.currency ?? "SOL",
    amount: payment.amount,
    reference: payment.reference,
    merchantName: merchantInfo?.name,
    merchantLogo: merchantInfo?.logoUrl,
  };
}

// ---------------------------------------------------------------------------
// POST /payments/create
// ---------------------------------------------------------------------------

/**
 * Create a new payment request.
 *
 * **`amount` MUST be denominated in SOL** (not lamports, not fiat) **or USDC**
 * (human-readable, e.g. 25.00) depending on the `currency` field.
 * The frontend is responsible for converting fiat to SOL/USDC before calling
 * this endpoint. The stored amount is passed directly to the on-chain
 * transfer instruction.
 */
export async function handleCreatePayment(
  ctx: HandlerContext,
  input: { amount: number; merchantWallet: string; currency?: "SOL" | "USDC" }
): Promise<{ paymentId: string; status: string }> {
  const { amount, merchantWallet, currency = "SOL" } = input;

  if (currency !== "SOL" && currency !== "USDC") {
    throw new SlikError("Invalid currency. Must be SOL or USDC.", 400);
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw new SlikError("Invalid amount. Must be a positive number.", 400);
  }

  if (currency === "USDC") {
    if (amount < 0.01) {
      throw new SlikError("Amount too small. Minimum is 0.01 USDC.", 400);
    }
    if (amount > 10000) {
      throw new SlikError(
        "Amount exceeds maximum allowed (10,000 USDC).",
        400
      );
    }
  } else {
    if (amount < 0.001) {
      throw new SlikError("Amount too small. Minimum is 0.001 SOL.", 400);
    }
    if (amount > 100) {
      throw new SlikError("Amount exceeds maximum allowed (100 SOL).", 400);
    }
  }

  if (!merchantWallet || typeof merchantWallet !== "string") {
    throw new SlikError("Missing merchantWallet.", 400);
  }

  try {
    new PublicKey(merchantWallet);
  } catch {
    throw new SlikError("Invalid merchant wallet address.", 400);
  }

  const paymentId = await createPayment(
    ctx.store,
    amount,
    merchantWallet,
    currency
  );

  return { paymentId, status: "awaiting_code" };
}

// ---------------------------------------------------------------------------
// POST /payments/link
// ---------------------------------------------------------------------------

export async function handleLinkPayment(
  ctx: HandlerContext,
  input: { paymentId: string; code: string }
): Promise<{
  matched: boolean;
  amount: number;
  walletPubkey: string;
  reference: string;
  receiptPda: string;
  merchantName?: string;
  merchantLogo?: string | null;
}> {
  const { paymentId, code } = input;

  if (!paymentId || typeof paymentId !== "string") {
    throw new SlikError("Missing or invalid paymentId.", 400);
  }

  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw new SlikError("Invalid code. Must be a 6-digit number.", 400);
  }

  const codeData = await resolveCode(ctx.store, code);
  if (!codeData) {
    throw new SlikError("Code not found or expired.", 404);
  }

  const payment = await getPayment(ctx.store, paymentId);
  if (!payment) {
    throw new SlikError("Payment not found or expired.", 404);
  }

  // Fast-fail status check before PDA derivation
  if (payment.status !== "awaiting_code") {
    throw new SlikError(
      `Payment cannot be linked. Current status: ${payment.status}`,
      409
    );
  }

  // Derive receipt PDA deterministically from paymentId
  const [receiptPda] = deriveReceiptPda(paymentId);
  const reference = receiptPda.toBase58();

  // Atomic update - only succeeds if status is still "awaiting_code"
  const linked = await atomicLinkPayment(ctx.store, paymentId, {
    status: "linked",
    code,
    walletPubkey: codeData.walletPubkey,
    reference,
  });

  if (!linked) {
    throw new SlikError("Payment was already linked by another request.", 409);
  }

  // Non-critical: link code record and store reference mapping
  await linkCodeToPayment(ctx.store, code, paymentId);
  await setReferenceMapping(ctx.store, reference, paymentId);

  // Lookup merchant info (returns null if db not configured or merchant not found)
  const merchantInfo = await lookupMerchant(ctx, payment.merchantWallet);

  return {
    matched: true,
    amount: payment.amount,
    walletPubkey: codeData.walletPubkey,
    reference,
    receiptPda: reference,
    merchantName: merchantInfo?.name,
    merchantLogo: merchantInfo?.logoUrl,
  };
}

// ---------------------------------------------------------------------------
// GET /payments/:id/status
// ---------------------------------------------------------------------------

export async function handlePaymentStatus(
  ctx: HandlerContext,
  input: { paymentId: string }
): Promise<{
  status: string;
  amount: number;
  code?: string;
  reference?: string;
}> {
  const { paymentId } = input;

  if (!paymentId) {
    throw new SlikError("Missing payment ID.", 400);
  }

  const payment = await getPayment(ctx.store, paymentId);

  if (!payment) {
    throw new SlikError("Payment not found or expired.", 404);
  }

  // Lazy on-chain check: if payment is linked and has a receipt PDA reference,
  // check if the receipt account exists on-chain (meaning payment was confirmed)
  if (payment.status === "linked" && payment.reference) {
    try {
      const receiptAccount = await ctx.connection.getAccountInfo(
        new PublicKey(payment.reference)
      );
      if (receiptAccount && receiptAccount.data.length > 0) {
        await updatePayment(ctx.store, paymentId, { status: "paid" });
        payment.status = "paid";
      }
    } catch {
      // ignore - return current status
    }
  }

  return {
    status: payment.status,
    amount: payment.amount,
    ...(payment.code && { code: payment.code }),
    ...(payment.reference && { reference: payment.reference }),
  };
}

// ---------------------------------------------------------------------------
// POST /pay
// ---------------------------------------------------------------------------

export async function handlePay(
  ctx: HandlerContext,
  input: { paymentId: string; account: string }
): Promise<{ transaction: string; message: string; receiptPda: string }> {
  const { paymentId, account } = input;

  if (!paymentId) {
    throw new SlikError("Missing paymentId.", 400);
  }

  if (!account || typeof account !== "string") {
    throw new SlikError("Missing or invalid account in request body.", 400);
  }

  let senderPubkey: PublicKey;
  try {
    senderPubkey = new PublicKey(account);
  } catch {
    throw new SlikError("Invalid Solana public key.", 400);
  }

  const payment = await getPayment(ctx.store, paymentId);
  if (!payment) {
    throw new SlikError("Payment not found or expired.", 404);
  }

  if (payment.status !== "linked") {
    throw new SlikError(
      `Payment is not ready for transaction. Current status: ${payment.status}`,
      409
    );
  }

  const merchantPubkey = new PublicKey(payment.merchantWallet);

  // Build the pay transaction using the SDK - branch on currency
  let transaction: Transaction;
  let receiptPda: PublicKey;

  if (payment.currency === "USDC") {
    const result = await createPayUsdcTransaction({
      customer: senderPubkey,
      merchant: merchantPubkey,
      amountUsdc: payment.amount,
      paymentId,
      connection: ctx.connection,
    });
    transaction = result.transaction;
    receiptPda = result.receiptPda;
  } else {
    const result = await createPayTransaction({
      customer: senderPubkey,
      merchant: merchantPubkey,
      amountSol: payment.amount,
      paymentId,
      connection: ctx.connection,
    });
    transaction = result.transaction;
    receiptPda = result.receiptPda;
  }

  // Store receipt PDA reference in payment record
  const receiptPdaBase58 = receiptPda.toBase58();
  await updatePayment(ctx.store, paymentId, {
    reference: receiptPdaBase58,
  });

  // Store reverse mapping
  await setReferenceMapping(ctx.store, receiptPdaBase58, paymentId);

  const serialized = Buffer.from(
    transaction.serialize({ requireAllSignatures: false })
  ).toString("base64");

  return {
    transaction: serialized,
    message: `Pay ${payment.amount} ${payment.currency ?? "SOL"} via SLIK`,
    receiptPda: receiptPdaBase58,
  };
}

// ---------------------------------------------------------------------------
// Internal helper - lookup merchant by wallet
// ---------------------------------------------------------------------------

export async function lookupMerchant(
  ctx: HandlerContext,
  walletAddress: string
): Promise<{ name: string; logoUrl: string | null } | null> {
  if (!ctx.db) return null;
  const merchant = await ctx.db.query.merchants.findFirst({
    where: eq(schema.merchants.walletAddress, walletAddress),
    columns: { name: true, logoUrl: true, status: true },
  });
  if (!merchant || merchant.status !== "active") return null;
  return { name: merchant.name, logoUrl: merchant.logoUrl };
}

// ---------------------------------------------------------------------------
// POST /merchants/register
// ---------------------------------------------------------------------------

export async function handleMerchantRegister(
  ctx: HandlerContext,
  input: { wallet: string; name: string; logoUrl?: string }
): Promise<{ id: string; status: string }> {
  if (!ctx.db) throw new SlikError("Merchant registry not configured.", 503);
  if (!input.wallet) throw new SlikError("Missing wallet.", 400);
  if (!input.name || input.name.trim().length < 2)
    throw new SlikError("Name must be at least 2 characters.", 400);

  // Check if already registered
  const existing = await ctx.db.query.merchants.findFirst({
    where: eq(schema.merchants.walletAddress, input.wallet),
  });
  if (existing) throw new SlikError("Wallet already registered.", 409);

  const [merchant] = await ctx.db
    .insert(schema.merchants)
    .values({
      walletAddress: input.wallet,
      name: input.name.trim(),
      logoUrl: input.logoUrl || null,
    })
    .returning({ id: schema.merchants.id, status: schema.merchants.status });

  return { id: merchant.id, status: merchant.status };
}

// ---------------------------------------------------------------------------
// GET /merchants/me?wallet=...
// ---------------------------------------------------------------------------

export async function handleMerchantProfile(
  ctx: HandlerContext,
  input: { wallet: string }
): Promise<{ merchant: any } | null> {
  if (!ctx.db) return null;
  if (!input.wallet) throw new SlikError("Missing wallet.", 400);

  const merchant = await ctx.db.query.merchants.findFirst({
    where: eq(schema.merchants.walletAddress, input.wallet),
  });

  if (!merchant) return null;

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      logoUrl: merchant.logoUrl,
      status: merchant.status,
      currencyPreference: merchant.currencyPreference,
      createdAt: merchant.createdAt,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /merchants/me/transactions?wallet=...
// ---------------------------------------------------------------------------

export async function handleMerchantTransactions(
  ctx: HandlerContext,
  input: { wallet: string }
): Promise<{ transactions: any[] }> {
  if (!ctx.db) throw new SlikError("Merchant registry not configured.", 503);
  if (!input.wallet) throw new SlikError("Missing wallet.", 400);

  const merchant = await ctx.db.query.merchants.findFirst({
    where: eq(schema.merchants.walletAddress, input.wallet),
  });
  if (!merchant) throw new SlikError("Merchant not found.", 404);

  const transactions = await ctx.db.query.merchantTransactions.findMany({
    where: eq(schema.merchantTransactions.merchantId, merchant.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  });

  return { transactions };
}
