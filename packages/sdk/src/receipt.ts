import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import { deriveReceiptPda } from "./pda";
import { bytesToUuid } from "./uuid";
import type { Receipt } from "./types";

/**
 * Parse raw account data into a Receipt object.
 * Layout: 8 (discriminator) + 32 (customer) + 32 (merchant) + 8 (amount) + 16 (payment_id) + 8 (timestamp) + 1 (bump)
 * Total: 105 bytes
 */
export function parseReceipt(data: Buffer, pda: PublicKey): Receipt {
  if (data.length < 105) throw new Error("Invalid receipt data length");

  // Skip 8-byte discriminator
  const customer = new PublicKey(data.subarray(8, 40));
  const merchant = new PublicKey(data.subarray(40, 72));

  // Read amount as u64 LE
  let amount = BigInt(0);
  for (let i = 0; i < 8; i++) {
    amount |= BigInt(data[72 + i]) << BigInt(i * 8);
  }
  const amountNum = Number(amount);

  const paymentIdBytes = new Uint8Array(data.subarray(80, 96));

  // Read timestamp as i64 LE
  let timestamp = BigInt(0);
  for (let i = 0; i < 8; i++) {
    timestamp |= BigInt(data[96 + i]) << BigInt(i * 8);
  }
  // Handle signed i64
  if (timestamp >= BigInt(2) ** BigInt(63)) {
    timestamp -= BigInt(2) ** BigInt(64);
  }

  const bump = data[104];

  return {
    customer,
    merchant,
    amount: amountNum,
    amountSol: amountNum / LAMPORTS_PER_SOL,
    paymentId: bytesToUuid(paymentIdBytes),
    paymentIdBytes,
    timestamp: Number(timestamp),
    bump,
    pda,
  };
}

/**
 * Fetch and parse a receipt from chain by payment ID.
 */
export async function fetchReceipt(
  connection: Connection,
  paymentId: string,
  programId: PublicKey = PROGRAM_ID
): Promise<Receipt | null> {
  const [receiptPda] = deriveReceiptPda(paymentId, programId);
  const accountInfo = await connection.getAccountInfo(receiptPda);
  if (!accountInfo || accountInfo.data.length === 0) return null;
  return parseReceipt(accountInfo.data as Buffer, receiptPda);
}

/**
 * Watch for a receipt to appear on-chain (WebSocket subscription).
 * Returns an unsubscribe function.
 */
export function watchReceipt(
  connection: Connection,
  paymentId: string,
  opts: {
    programId?: PublicKey;
    onConfirmed: (receipt: Receipt) => void;
    onError?: (err: Error) => void;
    timeoutMs?: number;
  }
): () => void {
  const {
    programId = PROGRAM_ID,
    onConfirmed,
    onError,
    timeoutMs = 180_000,
  } = opts;
  const [receiptPda] = deriveReceiptPda(paymentId, programId);
  let cleaned = false;

  const subId = connection.onAccountChange(
    receiptPda,
    (accountInfo) => {
      if (accountInfo.data.length > 0 && !cleaned) {
        try {
          const receipt = parseReceipt(
            Buffer.from(accountInfo.data),
            receiptPda
          );
          cleanup();
          onConfirmed(receipt);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    "confirmed"
  );

  const timer = setTimeout(() => {
    if (!cleaned) {
      cleanup();
      onError?.(new Error("Receipt watch timed out"));
    }
  }, timeoutMs);

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    connection.removeAccountChangeListener(subId);
  }

  return cleanup;
}
