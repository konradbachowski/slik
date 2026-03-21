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
