import { Connection, PublicKey } from "@solana/web3.js";
import {
  createPayTransaction,
  deriveReceiptPda,
} from "@solana-blik/sdk";
import type { Store } from "./storage";
import {
  createPaymentCode,
  resolveCode,
  createPayment,
  getPayment,
  updatePayment,
  linkCodeToPayment,
  setReferenceMapping,
} from "./storage";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class BlikError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "BlikError";
  }
}

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

export interface HandlerContext {
  store: Store;
  connection: Connection;
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
    throw new BlikError("Missing or invalid walletPubkey.", 400);
  }

  // Validate that it's a legit Solana public key
  try {
    new PublicKey(walletPubkey);
  } catch {
    throw new BlikError("Invalid Solana public key format.", 400);
  }

  const code = await createPaymentCode(ctx.store, walletPubkey);

  return { code, expiresIn: 120 };
}

// ---------------------------------------------------------------------------
// GET /codes/:code/resolve
// ---------------------------------------------------------------------------

export async function handleResolveCode(
  ctx: HandlerContext,
  input: { code: string }
): Promise<{
  status: string;
  paymentId?: string;
  amount?: number;
  reference?: string;
}> {
  const { code } = input;

  if (!code || !/^\d{6}$/.test(code)) {
    throw new BlikError("Invalid code format. Must be 6 digits.", 400);
  }

  const codeData = await resolveCode(ctx.store, code);

  if (!codeData) {
    throw new BlikError("Code not found or expired.", 404);
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

  if (payment.status === "paid") {
    return {
      status: "paid",
      paymentId: codeData.paymentId,
      amount: payment.amount,
    };
  }

  // Payment exists and is linked
  return {
    status: "linked",
    paymentId: codeData.paymentId,
    amount: payment.amount,
    reference: payment.reference,
  };
}

// ---------------------------------------------------------------------------
// POST /payments/create
// ---------------------------------------------------------------------------

export async function handleCreatePayment(
  ctx: HandlerContext,
  input: { amount: number; merchantWallet: string }
): Promise<{ paymentId: string; status: string }> {
  const { amount, merchantWallet } = input;

  if (typeof amount !== "number" || amount <= 0) {
    throw new BlikError("Invalid amount. Must be a positive number.", 400);
  }

  if (amount > 10_000) {
    throw new BlikError("Amount exceeds maximum allowed (10,000 SOL).", 400);
  }

  if (!merchantWallet || typeof merchantWallet !== "string") {
    throw new BlikError("Missing merchantWallet.", 400);
  }

  try {
    new PublicKey(merchantWallet);
  } catch {
    throw new BlikError("Invalid merchant wallet address.", 400);
  }

  const paymentId = await createPayment(ctx.store, amount, merchantWallet);

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
}> {
  const { paymentId, code } = input;

  if (!paymentId || typeof paymentId !== "string") {
    throw new BlikError("Missing or invalid paymentId.", 400);
  }

  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw new BlikError("Invalid code. Must be a 6-digit number.", 400);
  }

  const codeData = await resolveCode(ctx.store, code);
  if (!codeData) {
    throw new BlikError("Code not found or expired.", 404);
  }

  const payment = await getPayment(ctx.store, paymentId);
  if (!payment) {
    throw new BlikError("Payment not found or expired.", 404);
  }

  if (payment.status !== "awaiting_code") {
    throw new BlikError(
      `Payment cannot be linked. Current status: ${payment.status}`,
      409
    );
  }

  // Derive receipt PDA deterministically from paymentId
  const [receiptPda] = deriveReceiptPda(paymentId);

  // Link the code to the payment
  await linkCodeToPayment(ctx.store, code, paymentId);

  // Update payment with linked data
  const reference = receiptPda.toBase58();
  await updatePayment(ctx.store, paymentId, {
    status: "linked",
    code,
    walletPubkey: codeData.walletPubkey,
    reference,
  });

  // Store reverse mapping: reference -> paymentId
  await setReferenceMapping(ctx.store, reference, paymentId);

  return {
    matched: true,
    amount: payment.amount,
    walletPubkey: codeData.walletPubkey,
    reference,
    receiptPda: reference,
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
    throw new BlikError("Missing payment ID.", 400);
  }

  const payment = await getPayment(ctx.store, paymentId);

  if (!payment) {
    throw new BlikError("Payment not found or expired.", 404);
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
    throw new BlikError("Missing paymentId.", 400);
  }

  if (!account || typeof account !== "string") {
    throw new BlikError("Missing or invalid account in request body.", 400);
  }

  let senderPubkey: PublicKey;
  try {
    senderPubkey = new PublicKey(account);
  } catch {
    throw new BlikError("Invalid Solana public key.", 400);
  }

  const payment = await getPayment(ctx.store, paymentId);
  if (!payment) {
    throw new BlikError("Payment not found or expired.", 404);
  }

  if (payment.status !== "linked") {
    throw new BlikError(
      `Payment is not ready for transaction. Current status: ${payment.status}`,
      409
    );
  }

  const merchantPubkey = new PublicKey(payment.merchantWallet);

  // Build the pay transaction using the SDK
  const { transaction, receiptPda } = await createPayTransaction({
    customer: senderPubkey,
    merchant: merchantPubkey,
    amountSol: payment.amount,
    paymentId,
    connection: ctx.connection,
  });

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
    message: `Pay ${payment.amount} SOL via SolanaBLIK`,
    receiptPda: receiptPdaBase58,
  };
}
