import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/nextjs.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["@solana/web3.js", "@upstash/redis", "@solana-blik/sdk"],
});
