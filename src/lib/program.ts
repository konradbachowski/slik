// Re-export from SDK package
export {
  PROGRAM_ID,
  deriveReceiptPda,
  buildPayInstruction,
  createPayTransaction,
  fetchReceipt,
  watchReceipt,
  parseReceipt,
  uuidToBytes,
  bytesToUuid,
} from "@solana-blik/sdk";

// Backwards-compatible alias
export { createPayTransaction as createAnchorPaymentTransaction } from "@solana-blik/sdk";
