export interface CodeData {
  walletPubkey: string;
  paymentId?: string;
  createdAt: number;
}

export type PaymentStatus = "awaiting_code" | "linked" | "paid" | "expired";

export interface PaymentData {
  /** Amount in SOL (not lamports, not fiat) or USDC (human-readable) */
  amount: number;
  /** Payment currency. Default: "SOL" */
  currency: "SOL" | "USDC";
  status: PaymentStatus;
  merchantWallet: string;
  code?: string;
  reference?: string;
  walletPubkey?: string;
  createdAt: number;
}
