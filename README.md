# SolanaBLIK

Payment gateway inspired by [BLIK](https://en.wikipedia.org/wiki/Blik) (Polish instant payment system) built on Solana. Merchant enters amount, customer generates a 6-digit code, merchant types the code, customer approves in wallet, SOL is transferred instantly.

**Live:** https://solana-blik.vercel.app

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
                                           → SOL transferred to merchant
10. Payment confirmed
```

Two screens:
- `/` - customer (payer) interface
- `/merchant` - merchant (receiver) terminal

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Blockchain | Solana (`@solana/web3.js` v1, `@solana/pay` v0.2.6) |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare auto-detected) |
| State / codes | Upstash Redis (serverless, 120s TTL on codes, 300s on payments) |
| Price feed | CoinGecko API (SOL/PLN, SOL/USD, SOL/EUR, 60s cache) |
| Deploy | Vercel |

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create` | POST | Merchant creates payment (amount + wallet) |
| `/api/codes/generate` | POST | Customer generates 6-digit code |
| `/api/payments/link` | POST | Merchant links code to payment |
| `/api/payments/[id]/status` | GET | Poll payment status |
| `/api/codes/[code]/resolve` | GET | Customer polls if code was linked |
| `/api/pay` | GET/POST | Solana Pay Transaction Request endpoint |
| `/api/price` | GET | Current SOL prices in PLN/USD/EUR |

## Payment confirmation

Uses Solana Pay's `reference` mechanism - a random PublicKey is attached to each transaction as a non-signer account key. Backend polls `findReference()` to detect when the transaction lands on-chain, then marks payment as confirmed.

## Local development

```bash
npm install
npm run dev
```

Works without Redis (falls back to in-memory store with TTL). For production, set:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Currently on **devnet** - switch Phantom to devnet in Settings > Developer Settings. Get devnet SOL from https://faucet.solana.com

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Customer (payer) UI
│   ├── merchant/page.tsx           # Merchant terminal UI
│   └── api/
│       ├── codes/generate/         # Generate 6-digit code
│       ├── codes/[code]/resolve/   # Poll code status
│       ├── payments/create/        # Create payment
│       ├── payments/link/          # Link code to payment
│       ├── payments/[id]/status/   # Payment status
│       ├── pay/                    # Solana Pay TX builder
│       └── price/                  # SOL price feed
├── lib/
│   ├── codes.ts                    # Code/payment storage (Redis or in-memory)
│   ├── payment.ts                  # TX builder + chain polling
│   ├── price.ts                    # CoinGecko price fetcher
│   └── solana.ts                   # Connection constants
└── components/
    ├── AmountInput.tsx             # Numpad with fiat currency selector
    ├── CodeDisplay.tsx             # 6-digit code with timer + copy
    ├── CodeInput.tsx               # OTP-style code input
    ├── WalletButton.tsx            # Wallet connect button
    └── WalletProvider.tsx          # Solana wallet adapter providers
```
