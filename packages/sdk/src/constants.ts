import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv"
);

export const FEE_WALLET = new PublicKey(
  "2df3JmriVkhkBqdmYT2TgDBRo8E71WAJE1SbtLQ71Fkc"
);

export const FEE_BPS = 20; // 0.2% = 20 basis points

export const PAY_DISCRIMINATOR = new Uint8Array([
  119, 18, 216, 65, 192, 117, 122, 220,
]);

export const RECEIPT_DISCRIMINATOR = new Uint8Array([
  39, 154, 73, 106, 80, 102, 145, 153,
]);

// ---- USDC support ----

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
export const USDC_DECIMALS = 6;

// SHA256("global:pay_usdc") first 8 bytes
export const PAY_USDC_DISCRIMINATOR = new Uint8Array([
  24, 1, 58, 95, 8, 82, 131, 221,
]);
