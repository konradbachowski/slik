import { createBlikRoutes } from "@solana-blik/server/nextjs";
import { createUpstashStore, createMemoryStore } from "@solana-blik/server";
import { Connection, clusterApiUrl } from "@solana/web3.js";

const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as
  | "devnet"
  | "mainnet-beta";
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(SOLANA_NETWORK);

const connection = new Connection(RPC_ENDPOINT, "confirmed");

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const store = hasRedis
  ? createUpstashStore({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : createMemoryStore();

if (!hasRedis) {
  console.warn(
    "[solana-blik] No Redis configured - using in-memory store (dev only)"
  );
}

export const { GET, POST } = createBlikRoutes({ store, connection });
