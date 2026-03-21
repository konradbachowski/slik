import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import { uuidToBytes } from "./uuid";

export function deriveReceiptPda(
  paymentId: string | Uint8Array,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const idBytes =
    typeof paymentId === "string" ? uuidToBytes(paymentId) : paymentId;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), Buffer.from(idBytes)],
    programId
  );
}
