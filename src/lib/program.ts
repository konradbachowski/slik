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
} from "@slik-pay/sdk";

// Backwards-compatible alias
export { createPayTransaction as createAnchorPaymentTransaction } from "@slik-pay/sdk";
