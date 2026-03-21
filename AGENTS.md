<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SLIK - Architecture

## Structure

```
slik/
├── programs/slik/             # Anchor smart contract (Rust)
├── packages/
│   ├── sdk/                    # @slik-pay/sdk - on-chain SDK (TS)
│   └── server/                 # @slik-pay/server - backend handlers
├── src/                        # Next.js demo app (uses packages)
└── target/idl/                 # Generated IDL (anchor build)
```

## Anchor Program

- Program ID: `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`
- Single instruction: `pay(amount: u64, payment_id: [u8; 16])`
- Creates Receipt PDA: seeds = `["receipt", payment_id]`
- No escrow - direct SOL transfer customer -> merchant
- Emits `PaymentCompleted` event

## SDK Rules

- **DO NOT** use `@coral-xyz/anchor` runtime in SDK - build instructions manually
- Manual serialization: discriminator (8) + amount u64 LE (8) + payment_id (16) = 32 bytes
- Keep bundle small - no unnecessary dependencies
- All functions take `Connection` as parameter, never use global singleton

## Building

```bash
cd packages/sdk && npm run build      # builds ESM + CJS + DTS
cd packages/server && npm run build   # builds ESM + CJS + DTS
```

## Payment Flow

1. Merchant creates payment (amount + wallet) -> gets paymentId (UUID)
2. Customer generates 6-digit code -> stored in Redis (120s TTL)
3. Customer tells code to merchant verbally
4. Merchant enters code -> backend links code to payment, derives Receipt PDA
5. Customer approves -> wallet signs Anchor `pay` instruction
6. On-chain: SOL transferred + Receipt PDA created
7. Confirmation: WebSocket subscription on Receipt PDA (primary) + API polling (fallback)
