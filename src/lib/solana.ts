import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ||
  "devnet") as "devnet" | "mainnet-beta";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(SOLANA_NETWORK);

export const connection = new Connection(RPC_ENDPOINT, "confirmed");

// USDC on mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
// On devnet we'll use a mock token or SOL for demo
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT
  ? new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT)
  : new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const USDC_DECIMALS = 6;

export const MERCHANT_WALLET = process.env.MERCHANT_WALLET
  ? new PublicKey(process.env.MERCHANT_WALLET)
  : new PublicKey("11111111111111111111111111111111");
