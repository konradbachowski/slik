import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { PROGRAM_ID, PAY_DISCRIMINATOR, FEE_WALLET } from "./constants";
import { uuidToBytes } from "./uuid";
import { deriveReceiptPda } from "./pda";

export function buildPayInstruction(config: {
  customer: PublicKey;
  merchant: PublicKey;
  amountSol: number;
  paymentId: string;
  programId?: PublicKey;
}): { instruction: TransactionInstruction; receiptPda: PublicKey } {
  const {
    customer,
    merchant,
    amountSol,
    paymentId,
    programId = PROGRAM_ID,
  } = config;

  const paymentIdBytes = uuidToBytes(paymentId);
  const lamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
  const [receiptPda] = deriveReceiptPda(paymentIdBytes, programId);

  // Serialize: discriminator (8) + amount u64 LE (8) + payment_id (16) = 32 bytes
  const data = Buffer.alloc(32);
  data.set(PAY_DISCRIMINATOR, 0);

  // Write u64 little-endian
  for (let i = 0; i < 8; i++) {
    data[8 + i] = Number((lamports >> BigInt(i * 8)) & BigInt(0xff));
  }

  data.set(paymentIdBytes, 16);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: customer, isSigner: true, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: true },
      { pubkey: FEE_WALLET, isSigner: false, isWritable: true },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });

  return { instruction, receiptPda };
}
