import {
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { findReference, FindReferenceError } from "@solana/pay";
import BigNumber from "bignumber.js";
import { connection, USDC_MINT, USDC_DECIMALS, MERCHANT_WALLET } from "./solana";
import { getPayment, updatePayment, setReferenceMapping } from "./codes";

// ---------------------------------------------------------------------------
// Transaction builder
// ---------------------------------------------------------------------------

/**
 * Build a USDC transfer transaction from sender to MERCHANT_WALLET.
 *
 * @param senderPubkey  The payer's public key
 * @param amount        Amount in USDC (human-readable, e.g. 5.00)
 * @param reference     A unique Keypair public key used for findReference()
 * @returns             A partially-built Transaction (not signed)
 */
export async function createPaymentTransaction(
  senderPubkey: PublicKey,
  amount: number,
  reference: PublicKey
): Promise<Transaction> {
  // Resolve associated token accounts for sender and merchant
  const senderAta = await getAssociatedTokenAddress(USDC_MINT, senderPubkey);
  const merchantAta = await getAssociatedTokenAddress(USDC_MINT, MERCHANT_WALLET);

  // Convert human amount to token base units (USDC has 6 decimals)
  const amountInBaseUnits = BigInt(
    new BigNumber(amount)
      .multipliedBy(new BigNumber(10).pow(USDC_DECIMALS))
      .integerValue(BigNumber.ROUND_FLOOR)
      .toString()
  );

  const transferIx = createTransferCheckedInstruction(
    senderAta,    // source
    USDC_MINT,    // mint
    merchantAta,  // destination
    senderPubkey, // owner
    amountInBaseUnits,
    USDC_DECIMALS
  );

  // Append the reference key so findReference() can locate this TX on-chain.
  transferIx.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: senderPubkey,
  });

  tx.add(transferIx);

  return tx;
}

// ---------------------------------------------------------------------------
// Payment polling / confirmation
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 120; // ~3 minutes at 1.5s intervals

/**
 * Poll the Solana chain for a transaction referencing `reference`.
 * When found, validates it and marks the payment as `paid`.
 *
 * This is designed to run server-side as a fire-and-forget background task.
 */
export async function pollForPayment(
  reference: PublicKey,
  paymentId: string
): Promise<void> {
  let attempts = 0;

  while (attempts < POLL_MAX_ATTEMPTS) {
    attempts++;

    try {
      const signatureInfo = await findReference(connection, reference, {
        finality: "confirmed",
      });

      // Transaction found - mark payment as paid
      await updatePayment(paymentId, {
        status: "paid",
      });

      console.log(
        `[solana-blik] Payment ${paymentId} confirmed: ${signatureInfo.signature}`
      );
      return;
    } catch (error) {
      if (error instanceof FindReferenceError) {
        // Not found yet - keep polling
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      // Unexpected error - log and keep trying
      console.error(
        `[solana-blik] Error polling payment ${paymentId}:`,
        error
      );
      await sleep(POLL_INTERVAL_MS);
    }
  }

  // Timed out - mark as expired
  try {
    await updatePayment(paymentId, { status: "expired" });
  } catch {
    // Payment may have already expired from Redis TTL
  }

  console.warn(
    `[solana-blik] Payment ${paymentId} polling timed out after ${POLL_MAX_ATTEMPTS} attempts`
  );
}

/**
 * Generate a new reference Keypair and store the mapping to a paymentId.
 * Returns the Keypair so the public key can be used in the transaction.
 */
export async function createReference(paymentId: string): Promise<Keypair> {
  const referenceKeypair = Keypair.generate();
  await setReferenceMapping(
    referenceKeypair.publicKey.toBase58(),
    paymentId
  );
  return referenceKeypair;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
