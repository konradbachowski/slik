# SLIK

Payment gateway inspired by [BLIK](https://en.wikipedia.org/wiki/Blik) (Polish instant payment system) built on Solana with a custom Anchor program. Merchant enters amount, customer generates a 6-digit code, merchant types the code, customer approves in wallet, SOL is transferred atomically with an on-chain receipt.

**Live:** https://slik.vercel.app
**Program:** [`AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`](https://explorer.solana.com/address/AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv?cluster=devnet) (devnet)

## How it works

```
Merchant                                Customer
────────                                ────────
1. Connect wallet
2. Enter amount (PLN/USD/EUR)
   → auto-converts to SOL
3. Wait for code...
                                        4. Connect wallet (Phantom)
                                        5. Generate 6-digit code (120s TTL)
                                        6. Tell code to merchant
7. Enter 6-digit code
   → code linked to payment
                                        8. See payment request + amount
                                        9. Approve in wallet
                                           → Anchor program executes:
                                             SOL transfer + receipt PDA + event
10. Payment confirmed (instant via WebSocket)
```

Two screens:
- `/` - customer (payer) interface
- `/merchant` - merchant (receiver) terminal

## Architecture

Hybrid design — server handles what it does best (codes, matching, prices), Anchor program handles what blockchain does best (atomic payments, on-chain proof).

```
Off-chain (Next.js + Redis)              On-chain (Anchor program)
───────────────────────────              ─────────────────────────
• 6-digit code generation                • Atomic SOL transfer
• Code ↔ payment matching               • Receipt PDA (permanent proof)
• Fiat price feed (CoinGecko)            • PaymentCompleted event
• Rate limiting, validation              • Double-payment prevention
```

### Payment confirmation

Uses WebSocket subscription on the receipt PDA (`connection.onAccountChange`). When the Anchor program creates the receipt account on-chain, both merchant and customer get instant notification (~400ms). HTTP polling at 3s serves as fallback if WebSocket drops.

## Anchor Program

Single instruction `pay(amount, payment_id)`:

1. Transfers SOL from customer to merchant via `system_program::transfer`
2. Creates a receipt PDA (seeds: `["receipt", payment_id]`) — permanent on-chain proof
3. Emits `PaymentCompleted` event for WebSocket listeners

Receipt PDA stores: customer, merchant, amount, payment_id, timestamp, bump.

```
programs/slik/src/lib.rs             # Program source
target/idl/slik.json                 # Generated IDL
src/lib/idl/                         # IDL + types (copied for frontend)
```

## SDK

SLIK ships as two npm packages so any app can integrate BLIK-style payments:

### `@slik-pay/sdk` — on-chain client

Transaction building, PDA derivation, receipt verification, React hooks. No `@coral-xyz/anchor` runtime — instructions are built manually for minimal bundle size.

```bash
# From this monorepo (file: dependency)
npm install @slik-pay/sdk@file:./packages/sdk @solana/web3.js

# Or clone and link
git clone https://github.com/konradbachowski/slik.git
cd slik/packages/sdk && npm install && npm run build
```

```typescript
import { createPayTransaction, deriveReceiptPda, fetchReceipt, watchReceipt } from "@slik-pay/sdk";

// Build a pay transaction
const { transaction, receiptPda } = await createPayTransaction({
  customer: customerPubkey,
  merchant: merchantPubkey,
  amountSol: 0.5,
  paymentId: "550e8400-e29b-41d4-a716-446655440000",
  connection,
});

// Watch for on-chain confirmation (WebSocket)
const unsubscribe = watchReceipt(connection, paymentId, {
  onConfirmed: (receipt) => console.log("Paid!", receipt.amountSol, "SOL"),
  timeoutMs: 120_000,
});
```

**React hooks** (`@slik-pay/sdk/react`):

```tsx
import { usePaymentCode, useSlikPay, useMerchantPayment } from "@slik-pay/sdk/react";

// Customer: generate code & approve payment
const { code, status, linkedPayment, generate } = usePaymentCode({ apiBaseUrl: "/api" });
const { pay, status: payStatus } = useSlikPay();

// Merchant: create payment & watch for confirmation
const { createPayment, linkCode, status } = useMerchantPayment({ apiBaseUrl: "/api", connection });
```

### `@slik-pay/server` — backend handlers

Framework-agnostic payment handlers + storage adapters. One catch-all route replaces 7 API endpoints.

```bash
# From this monorepo (file: dependency)
npm install @slik-pay/sdk@file:./packages/sdk @slik-pay/server@file:./packages/server @solana/web3.js
```

**Next.js integration (~10 lines):**

```typescript
// app/api/[...path]/route.ts
import { createSlikRoutes } from "@slik-pay/server/nextjs";
import { createUpstashStore } from "@slik-pay/server";
import { Connection, clusterApiUrl } from "@solana/web3.js";

const store = createUpstashStore({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export const { GET, POST } = createSlikRoutes({ store, connection });
```

For development without Redis, use `createMemoryStore()` — works identically with TTL-based expiration.

Rate limiting is enabled by default. Disable with `rateLimit: false`:

```typescript
export const { GET, POST } = createSlikRoutes({ store, connection, rateLimit: false });
```

## Security

### Rate limiting

All API endpoints are rate-limited per IP using a fixed-window counter stored in the same Redis instance. The `/codes/resolve` endpoint has an additional burst limiter (100 req/10s) to prevent brute-force enumeration of active 6-digit codes.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /codes/generate` | 5 | 60s |
| `GET /codes/{code}/resolve` | 30 + 100 burst | 60s / 10s |
| `POST /payments/create` | 10 | 60s |
| `POST /payments/link` | 10 | 60s |
| `GET /payments/{id}/status` | 30 | 60s |
| `POST /pay` | 5 | 60s |

### Atomic code linking

Payment linking uses a Redis Lua script (compare-and-set) to prevent race conditions. If two merchants enter the same code simultaneously, exactly one succeeds and the other receives a `409 Conflict`. No TOCTOU window.

### Security headers

All responses include: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.

### Cryptographic code generation

Payment codes use `crypto.getRandomValues()` instead of `Math.random()` for unpredictable generation.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Smart contract | Anchor 0.32, Rust |
| Blockchain | Solana devnet (`@solana/web3.js` v1) |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare auto-detected) |
| State / codes | Upstash Redis (serverless, 120s TTL on codes, 300s on payments) |
| Price feed | CoinGecko API (SOL/PLN, SOL/USD, SOL/EUR, 60s cache) |
| Deploy | Vercel (frontend), Solana devnet (program) |

## API endpoints

All served by a single catch-all route (`api/[...path]/route.ts`) via `@slik-pay/server`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create` | POST | Merchant creates payment (amount + wallet) |
| `/api/codes/generate` | POST | Customer generates 6-digit code |
| `/api/payments/link` | POST | Merchant links code to payment, derives receipt PDA |
| `/api/payments/{id}/status` | GET | Payment status (with lazy on-chain check) |
| `/api/codes/{code}/resolve` | GET | Customer polls if code was linked |
| `/api/pay` | GET/POST | Builds Anchor `pay` TX, returns serialized + receiptPda |
| `/api/price` | GET | Current SOL prices in PLN/USD/EUR |

## Local development

```bash
npm install
npm run dev
```

Works without Redis (falls back to in-memory store with TTL). For production, set:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_PROGRAM_ID=AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv
```

### Building the Anchor program

```bash
anchor build
cargo-build-sbf --manifest-path programs/slik/Cargo.toml --sbf-out-dir target/deploy
solana program deploy target/deploy/slik.so --program-id target/deploy/slik-keypair.json --url devnet
```

Currently on **devnet** — switch Phantom to devnet in Settings > Developer Settings. Get devnet SOL from https://faucet.solana.com

## Project structure

```
├── programs/slik/
│   └── src/lib.rs                    # Anchor program (pay instruction)
├── packages/
│   ├── sdk/                          # @slik-pay/sdk
│   │   └── src/
│   │       ├── index.ts              # Core: TX building, PDA, receipt parsing
│   │       └── react/                # React hooks (usePaymentCode, useSlikPay, etc.)
│   └── server/                       # @slik-pay/server
│       └── src/
│           ├── handlers.ts           # Framework-agnostic payment handlers
│           ├── storage.ts            # Store interface + Redis/memory adapters + atomic ops
│           ├── ratelimit.ts          # Per-IP rate limiting (fixed-window counter)
│           └── adapters/nextjs.ts    # Next.js catch-all route adapter
├── src/
│   ├── middleware.ts                  # Security headers (CSP, X-Frame-Options, etc.)
│   ├── app/
│   │   ├── page.tsx                  # Customer UI (uses SDK hooks)
│   │   ├── merchant/page.tsx         # Merchant terminal (uses SDK hooks)
│   │   └── api/[...path]/route.ts   # Single catch-all (uses server package)
│   ├── lib/                          # Re-exports from SDK packages
│   └── components/
│       ├── AmountInput.tsx           # Numpad with fiat currency selector
│       ├── CodeDisplay.tsx           # 6-digit code with timer + copy
│       ├── CodeInput.tsx             # OTP-style code input
│       ├── WalletButton.tsx          # Wallet connect button
│       └── WalletProvider.tsx        # Solana wallet adapter providers
├── Anchor.toml                       # Anchor workspace config
└── target/deploy/                    # Compiled .so + keypair
```
