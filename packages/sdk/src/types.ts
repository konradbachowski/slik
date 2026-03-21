import type { PublicKey } from "@solana/web3.js";

export interface Receipt {
  customer: PublicKey;
  merchant: PublicKey;
  amount: number;
  amountSol: number;
  paymentId: string;
  paymentIdBytes: Uint8Array;
  timestamp: number;
  bump: number;
  pda: PublicKey;
}

export interface PaymentCompleted {
  paymentId: string;
  customer: PublicKey;
  merchant: PublicKey;
  amount: number;
  timestamp: number;
}
