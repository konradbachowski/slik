import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  PAY_DISCRIMINATOR,
  PAY_USDC_DISCRIMINATOR,
  FEE_WALLET,
  USDC_MINT,
  USDC_DECIMALS,
} from "./constants";
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

export function buildPayUsdcInstruction(config: {
  customer: PublicKey;
  merchant: PublicKey;
  amountUsdc: number; // human-readable, e.g. 25.00
  paymentId: string;
  programId?: PublicKey;
}): { instruction: TransactionInstruction; receiptPda: PublicKey } {
  // Lazy-import to keep spl-token optional for SOL-only consumers
  let getAssociatedTokenAddressSync: typeof import("@solana/spl-token").getAssociatedTokenAddressSync;
  let TOKEN_PROGRAM_ID: typeof import("@solana/spl-token").TOKEN_PROGRAM_ID;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const splToken = require("@solana/spl-token");
    getAssociatedTokenAddressSync = splToken.getAssociatedTokenAddressSync;
    TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
  } catch {
    throw new Error(
      "@solana/spl-token is required for USDC payments. Install it: npm i @solana/spl-token"
    );
  }

  const {
    customer,
    merchant,
    amountUsdc,
    paymentId,
    programId = PROGRAM_ID,
  } = config;

  const paymentIdBytes = uuidToBytes(paymentId);
  // Convert human-readable USDC to atomic units (6 decimals)
  const atomicAmount = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
  const [receiptPda] = deriveReceiptPda(paymentIdBytes, programId);

  // Derive Associated Token Accounts
  const customerUsdc = getAssociatedTokenAddressSync(USDC_MINT, customer);
  const merchantUsdc = getAssociatedTokenAddressSync(USDC_MINT, merchant);
  const feeUsdc = getAssociatedTokenAddressSync(USDC_MINT, FEE_WALLET);

  // Serialize: discriminator (8) + amount u64 LE (8) + payment_id (16) = 32 bytes
  const data = Buffer.alloc(32);
  data.set(PAY_USDC_DISCRIMINATOR, 0);
  for (let i = 0; i < 8; i++) {
    data[8 + i] = Number((atomicAmount >> BigInt(i * 8)) & BigInt(0xff));
  }
  data.set(paymentIdBytes, 16);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: customer, isSigner: true, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: true },
      { pubkey: FEE_WALLET, isSigner: false, isWritable: true },
      { pubkey: customerUsdc, isSigner: false, isWritable: true },
      { pubkey: merchantUsdc, isSigner: false, isWritable: true },
      { pubkey: feeUsdc, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: receiptPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
