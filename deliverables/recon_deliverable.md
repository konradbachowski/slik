# Reconnaissance Deliverable: SolanaBLIK Payment Gateway

## 0) HOW TO READ THIS REPORT

This reconnaissance report provides a comprehensive map of the SolanaBLIK application's attack surface, with special emphasis on authorization and privilege escalation opportunities for subsequent analysis specialists.

**Key Sections for Vulnerability Analysis:**

- **Section 4 (API Endpoint Inventory):** Contains authorization details for each endpoint - focus on "Required Role" and "Object ID Parameters" columns to identify IDOR candidates.
- **Section 6.4 (Guards Directory):** Catalog of authorization controls - understand what each guard means before analyzing vulnerabilities.
- **Section 7 (Role & Privilege Architecture):** Complete role hierarchy and privilege mapping - use this to understand the privilege lattice and identify escalation targets.
- **Section 8 (Authorization Vulnerability Candidates):** Pre-prioritized lists of endpoints for horizontal, vertical, and context-based authorization testing.

**How to Use the Network Mapping (Section 6):** The entity/flow mapping shows system boundaries and data sensitivity levels. Pay special attention to flows marked with authorization guards and entities handling PII/sensitive data.

**Priority Order for Testing:**
1. Start with Section 8's High-priority horizontal candidates
2. Then vertical escalation endpoints for each role level
3. Finally context-based workflow bypasses
4. Reference Section 9 for injection source analysis

---

## 1. Executive Summary

**Application Purpose:** SolanaBLIK is a decentralized payment gateway that enables instant cryptocurrency payments using BLIK-style 6-digit codes on the Solana blockchain. The application bridges traditional payment UX (6-digit codes, merchant terminals) with Web3 infrastructure (wallet signatures, blockchain settlement).

**Core Technology Stack:**
- **Frontend:** Next.js 16.2.0 (App Router), React 19.2.4, Tailwind CSS 4.2.2
- **Backend:** Next.js API Routes (serverless functions), TypeScript 5.9.3
- **Infrastructure:** Vercel (hosting), Upstash Redis (state storage), Solana Devnet (blockchain)
- **Blockchain:** Solana Web3.js 1.98.4, Anchor 0.30.1, custom Anchor program (Rust)

**Primary User-Facing Components:**
1. **Customer Interface** (`/`) - Wallet connection, code generation, payment approval
2. **Merchant Terminal** (`/merchant`) - Payment request creation, code entry, payment confirmation
3. **API Layer** (8 endpoints) - Stateless REST API for payment orchestration
4. **Smart Contract** - On-chain payment settlement and receipt creation

**Deployment Status:** Development/PoC only (Solana devnet). **NOT PRODUCTION-READY** - lacks authentication, rate limiting, and security headers.

**Attack Surface Summary:**
- **8 API endpoints** (all unauthenticated)
- **2 web interfaces** (customer and merchant)
- **1 blockchain program** (on Solana devnet)
- **3 external dependencies** (CoinGecko, Solana RPC, Upstash Redis)
- **Zero authentication** on any endpoint
- **Zero authorization controls** (no role checks, no object ownership validation)

---

## 2. Technology & Service Map

### Frontend

**Framework:**
- Next.js 16.2.0 with App Router
- React 19.2.4 (concurrent features enabled)
- React Compiler enabled (experimental optimization)

**Key Libraries:**
- Tailwind CSS 4.2.2 (styling)
- @solana/wallet-adapter-react 0.15.39 (wallet integration)
- @solana/wallet-adapter-react-ui 0.9.39 (wallet UI components)
- @solana/web3.js 1.98.4 (blockchain client)
- @solana/pay 0.2.6 (Solana Pay protocol)

**Authentication Libraries:**
- Wallet-based authentication only (no traditional auth)
- Auto-connect enabled in wallet provider

### Backend

**Language & Framework:**
- TypeScript 5.9.3 (strict mode enabled)
- Next.js API Routes (serverless edge functions)
- Node.js >=20.9.0 required

**Key Dependencies:**
- @solana-blik/server 0.1.0 (custom monorepo package)
- @solana-blik/sdk 0.1.0 (custom SDK for transactions)
- @upstash/redis 1.37.0 (serverless Redis client)
- uuid 13.0.0 (payment ID generation)
- bignumber.js 10.0.2 (decimal arithmetic)

**Build Tools:**
- tsup 8.x (TypeScript bundler for packages)
- SWC (built into Next.js for fast compilation)

### Infrastructure

**Hosting Provider:**
- Vercel (serverless deployment)
- Live URL: https://solana-blik.vercel.app
- No custom Vercel configuration (using defaults)

**CDN:**
- Vercel Edge Network (automatic)

**Database Type:**
- Primary: Upstash Redis (serverless, REST API)
- Fallback: In-memory Map (development only)
- TTL-based expiration (codes: 120s, payments: 300s)

**Blockchain:**
- Solana Devnet
- Program ID: `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`
- Anchor Framework 0.32.0 (Rust smart contract)

### Identified Subdomains

**Primary Domain:** solana-blik.vercel.app

**No additional subdomains discovered** (single-domain deployment)

### Open Ports & Services

**Network-Accessible Services:**

| Port | Service | Purpose | Public Access |
|------|---------|---------|---------------|
| 443 | HTTPS (Vercel) | Web application & API | Yes |
| N/A | Upstash Redis REST | State storage (via HTTPS REST API) | Server-only |
| N/A | Solana RPC | Blockchain queries (HTTPS + WSS) | Yes (public endpoint) |
| N/A | CoinGecko API | Price feeds (HTTPS) | Yes (public API) |

**Note:** Application uses serverless architecture - no traditional open ports. All communication over HTTPS (443) or WebSocket Secure (WSS).

**External Dependencies:**
1. **api.devnet.solana.com** - Solana RPC endpoint (HTTPS + WebSocket)
2. **api.coingecko.com** - Primary price feed
3. **api.binance.com** - Fallback price feed #1
4. **api.kraken.com** - Fallback price feed #2
5. **supreme-rattler-78549.upstash.io** - Redis storage

---

## 3. Authentication & Session Management Flow

### Entry Points

**Primary Authentication Entry Point:** Wallet Connection via `WalletButton` component

**Implementation Location:** `/src/components/WalletButton.tsx` (dynamically loaded)

**Authentication Type:** Wallet-based (cryptographic signature authentication)

**No Traditional Login:** No username/password, no JWT tokens, no session cookies

### Mechanism: Wallet-Based Authentication

**Step-by-Step Authentication Flow:**

1. **User Navigates to Application**
   - Customer page: `/` or Merchant terminal: `/merchant`
   - Application wrapped in `AppWalletProvider` (src/app/layout.tsx:39)

2. **Wallet Connection Prompt**
   - User sees "Select Wallet" button
   - Customer: src/app/page.tsx:202 (disconnected state)
   - Merchant: src/app/merchant/page.tsx:218

3. **Wallet Selection & Approval**
   - User clicks button → `WalletMultiButton` modal opens
   - Displays available wallets (Phantom, Solflare, etc.)
   - Auto-detection via Wallet Standard API
   - User selects wallet and approves connection

4. **Wallet Extension Communication**
   - Browser wallet extension receives connection request
   - User approves in wallet popup
   - Extension returns public key to application

5. **State Update (Client-Side)**
   - `useWallet()` hook updates:
     - `connected = true`
     - `publicKey = <PublicKey object>`
     - `sendTransaction = <function>`
   - React components re-render with authenticated state

6. **No Server-Side Session**
   - **CRITICAL:** No session created on server
   - No cookies set
   - No JWT issued
   - Wallet connection state exists only in browser memory

7. **Transaction Signing as Authentication**
   - When user performs sensitive actions (e.g., payment approval)
   - Server builds transaction and sends to client
   - Client calls `sendTransaction(transaction, connection)`
   - Wallet prompts user to sign with private key
   - **Signature proves wallet ownership** (cryptographic authentication)
   - Signed transaction broadcast to Solana blockchain

**Code Pointers:**
- Wallet Provider: `/src/components/WalletProvider.tsx:17-28`
- Wallet Button: `/src/components/WalletButton.tsx:5-19`
- Auth State Usage (Customer): `/src/app/page.tsx:21` (`useWallet()` hook)
- Auth State Usage (Merchant): `/src/app/merchant/page.tsx:21`
- Transaction Signing: `/packages/sdk/src/react/useBlikPay.ts:58-75`

### 3.1 Role Assignment Process

**Role Determination:** Implicit, context-based (NOT enforced)

**Actor Types:**
1. **Customer** - Any wallet that generates a payment code via `POST /api/codes/generate`
2. **Merchant** - Any wallet that creates a payment request via `POST /api/payments/create`

**Role Assignment Logic:**
- **Self-assigned** through API endpoint selection
- No registration process
- No role database
- No role validation

**Critical Finding:** A single wallet can act as BOTH customer and merchant simultaneously. No restrictions exist.

**Default Role:** None (unauthenticated by default)

**Role Upgrade Path:** N/A (no role hierarchy exists)

**Code Implementation:**
- Customer role implied: `/packages/server/src/handlers.ts:44-64` (handleGenerateCode)
- Merchant role implied: `/packages/server/src/handlers.ts:123-151` (handleCreatePayment)
- **No role storage** - roles are inferred from actions, not stored

### 3.2 Privilege Storage & Validation

**Storage Location:** None (no persistent role storage)

**Ephemeral "Privileges" Stored in Redis:**
- Code ownership: `code:<6-digits>` → `{ walletPubkey: string }` (120s TTL)
- Payment ownership: `payment:<uuid>` → `{ merchantWallet: string }` (300s TTL)

**Validation Points:**
- **Zero authorization middleware**
- **Zero inline role checks**
- **Zero object ownership validation**

**Critical Vulnerability:** Server accepts wallet public key as string in request body without signature verification.

**Example - Code Generation (NO SIGNATURE VERIFICATION):**
```
POST /api/codes/generate
Body: { "walletPubkey": "ANY_VALID_SOLANA_ADDRESS" }

Server Response: { "code": "123456", "expiresIn": 120 }
```

An attacker can generate codes for ANY wallet without owning it.

**Cache/Session Persistence:**
- Client-side only: Wallet connection persists in browser until page refresh
- Server-side: No session storage (stateless API)

**Code Pointers:**
- Wallet validation (format only): `/packages/server/src/handlers.ts:54-59`
- Payment status checks: `/packages/server/src/handlers.ts:187-192, 300-305`
- **NO ownership validation exists**

### 3.3 Role Switching & Impersonation

**Impersonation Features:** None

**Role Switching:** Not applicable (no roles exist)

**Audit Trail:** None (no logging of user actions)

**Code Implementation:** N/A

**Finding:** Any user can switch between customer and merchant "roles" by simply calling different API endpoints. No restrictions or logging.

---

## 4. API Endpoint Inventory

**Network Surface Focus:** All endpoints listed below are accessible through the deployed web application at https://solana-blik.vercel.app.

### Complete Endpoint Authorization Matrix

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|---------------------|------------------------|---------------------------|
| POST | `/api/codes/generate` | None | None | **NONE** | Generates 6-digit payment code for any wallet. **CRITICAL VULN:** No signature verification. `/packages/server/src/handlers.ts:44-64` |
| GET | `/api/codes/{code}/resolve` | None | `code` (6-digit) | **NONE** | Resolves code to payment details. **VULN:** Enables code enumeration (900K possibilities). `/packages/server/src/handlers.ts:70-118` |
| POST | `/api/payments/create` | None | None | **NONE** | Creates payment request for any merchant wallet. **CRITICAL VULN:** No wallet ownership proof. `/packages/server/src/handlers.ts:123-151` |
| POST | `/api/payments/link` | None | `paymentId` (UUID), `code` (6-digit) | Status check only | Links customer code to merchant payment. **VULN:** No ownership validation, vulnerable to race conditions. `/packages/server/src/handlers.ts:157-219` |
| GET | `/api/payments/{id}/status` | None | `paymentId` (UUID) | **NONE** | Retrieves payment status. **VULN:** Information disclosure if UUID guessed. `/packages/server/src/handlers.ts:225-268` |
| POST | `/api/pay` | None | `paymentId` (UUID), `account` (wallet) | **NONE** | Builds unsigned payment transaction. **CRITICAL VULN:** No verification that `account` owns the payment. `/packages/server/src/handlers.ts:274-336` |
| GET | `/api/price` | None | None | None (public) | Fetches current SOL price from CoinGecko/Binance/Kraken. Safe - read-only public data. `/packages/server/src/adapters/nextjs.ts:56-69` |
| GET | `/api/pay` | None | None | None (public) | Returns Solana Pay protocol metadata `{label, icon}`. Safe - static data. `/packages/server/src/adapters/nextjs.ts:71-74` |

### Endpoint Details

#### 1. POST /api/codes/generate
**Purpose:** Generate 6-digit payment code for customer wallet

**Request:**
```json
{
  "walletPubkey": "7xKL...9sT2"  // Solana public key (base58)
}
```

**Response:**
```json
{
  "code": "123456",
  "expiresIn": 120  // seconds
}
```

**Validation:**
- Type check: `walletPubkey` must be string
- Format check: Must be valid Solana public key (base58, 32-44 chars)
- **MISSING:** No signature verification - attacker can use any valid address

**Storage:** Creates `code:123456 → {walletPubkey, createdAt}` in Redis (120s TTL)

**Authorization Issues:**
- ❌ No proof of wallet ownership
- ❌ No rate limiting (can spam code generation)
- ❌ Can generate codes for victim wallets

**File:** `/packages/server/src/handlers.ts:44-64`

#### 2. GET /api/codes/:code/resolve
**Purpose:** Check if code has been linked to a payment

**Request:** `GET /api/codes/123456/resolve`

**Response (waiting):**
```json
{
  "status": "waiting"
}
```

**Response (linked):**
```json
{
  "status": "linked",
  "paymentId": "550e8400-...",
  "amount": 0.5,
  "reference": "Abc...xyz"  // Receipt PDA
}
```

**Validation:**
- Regex: Code must match `/^\d{6}$/`

**Authorization Issues:**
- ❌ No authentication (anyone can query any code)
- ❌ Enables brute-force enumeration (000000-999999)
- ❌ No rate limiting
- ⚠️ Timing attacks possible (different response for valid vs invalid codes)

**File:** `/packages/server/src/handlers.ts:70-118`

#### 3. POST /api/payments/create
**Purpose:** Create payment request (merchant-side)

**Request:**
```json
{
  "amount": 0.5,  // SOL
  "merchantWallet": "9Kj...xP8"
}
```

**Response:**
```json
{
  "paymentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "awaiting_code"
}
```

**Validation:**
- `amount` > 0 and ≤ 10,000 SOL
- `merchantWallet` must be valid Solana public key format
- **MISSING:** No signature verification

**Storage:** Creates `payment:<uuid> → {amount, merchantWallet, status, createdAt}` in Redis (300s TTL)

**Authorization Issues:**
- ❌ No proof of merchant wallet ownership
- ❌ Attacker can create payments impersonating any merchant
- ❌ No rate limiting

**File:** `/packages/server/src/handlers.ts:123-151`

#### 4. POST /api/payments/link
**Purpose:** Link customer's code to merchant's payment

**Request:**
```json
{
  "paymentId": "550e8400-...",
  "code": "123456"
}
```

**Response:**
```json
{
  "matched": true,
  "amount": 0.5,
  "walletPubkey": "7xKL...9sT2",
  "reference": "Abc...xyz",  // Receipt PDA
  "receiptPda": "Abc...xyz"
}
```

**Validation:**
- `paymentId` must exist in Redis
- `code` must match `/^\d{6}$/` and exist in Redis
- `payment.status` must be "awaiting_code"
- **MISSING:** No verification that requester owns payment or code

**State Changes:**
- Updates code: adds `paymentId` field
- Updates payment: sets `status="linked"`, adds `code`, `walletPubkey`, `reference`
- Creates reverse mapping: `ref:<receiptPda> → paymentId`

**Authorization Issues:**
- ❌ Anyone who knows paymentId + code can link them
- ❌ No ownership validation
- ⚠️ Race condition: Multiple merchants can link same code simultaneously (no mutex)

**File:** `/packages/server/src/handlers.ts:157-219`

#### 5. GET /api/payments/:id/status
**Purpose:** Check payment status (polling endpoint)

**Request:** `GET /api/payments/550e8400-.../status`

**Response:**
```json
{
  "status": "linked",  // or "awaiting_code", "paid", "expired"
  "amount": 0.5,
  "code": "123456",
  "reference": "Abc...xyz"
}
```

**Special Behavior:**
- Performs lazy on-chain verification if `status="linked"` and `reference` exists
- Queries Solana for receipt PDA account
- Auto-updates to `status="paid"` if receipt found on-chain

**Validation:**
- `paymentId` presence check only (no format validation)

**Authorization Issues:**
- ❌ No authentication
- ❌ Information disclosure (exposes amount, merchant wallet if UUID guessed)
- ⚠️ UUIDs are random but enumeration still possible with time

**File:** `/packages/server/src/handlers.ts:225-268`

#### 6. POST /api/pay
**Purpose:** Build unsigned Solana transaction for payment

**Request:**
```json
{
  "paymentId": "550e8400-...",
  "account": "7xKL...9sT2"  // Customer wallet that will sign
}
```

**Response:**
```json
{
  "transaction": "AQAAAAAAAADq...",  // base64-encoded unsigned transaction
  "message": "Pay 0.5 SOL via SolanaBLIK",
  "receiptPda": "Abc...xyz"
}
```

**Validation:**
- `paymentId` must exist
- `account` must be valid Solana public key
- `payment.status` must be "linked"
- **MISSING:** No verification that `account` matches `payment.walletPubkey`

**Critical Vulnerability:**
Attacker can build transaction for ANY payment using THEIR OWN wallet:
```
POST /api/pay
{
  "paymentId": "<victim's payment>",
  "account": "<attacker's wallet>"
}
```
Merchant receives payment from wrong wallet, receipt shows wrong payer.

**File:** `/packages/server/src/handlers.ts:274-336`

#### 7. GET /api/price
**Purpose:** Public price feed endpoint

**Request:** `GET /api/price?currency=PLN`

**Response:**
```json
{
  "price": 560.25,
  "currency": "PLN"
}
```

**Authorization:** None needed (public data)

**Safe endpoint** - No security concerns

**File:** `/packages/server/src/adapters/nextjs.ts:56-69`

#### 8. GET /api/pay (Solana Pay metadata)
**Purpose:** Solana Pay protocol label endpoint

**Response:**
```json
{
  "label": "SolanaBLIK",
  "icon": "/icon.png"
}
```

**Authorization:** None needed (public metadata)

**Safe endpoint** - No security concerns

**File:** `/packages/server/src/adapters/nextjs.ts:71-74`

### Smart Contract Instruction (On-Chain)

| Instruction | Accounts | Authorization | File |
|------------|----------|--------------|------|
| `pay(amount: u64, payment_id: [u8; 16])` | 1. customer (signer, mut)<br>2. merchant (mut) - **UNCHECKED**<br>3. receipt PDA (init, mut)<br>4. system_program | ✅ Customer signature required (Solana enforced)<br>❌ Merchant NOT validated (accepts any account) | `/programs/solanablik/src/lib.rs:6-38` |

**Critical Smart Contract Vulnerability:**
Merchant account uses `UncheckedAccount` - contract accepts ANY account as merchant without validation. Attacker can build transaction sending SOL to arbitrary address instead of legitimate merchant.

---

## 5. Potential Input Vectors for Vulnerability Analysis

**Network Surface Focus:** All input vectors listed below are accessible through network requests to the deployed application.

### URL Parameters

| Endpoint | Parameter | Location | Validation | File:Line |
|----------|-----------|----------|------------|-----------|
| `GET /api/price` | `currency` | Query string | Type cast to enum ("USD"\|"PLN"\|"EUR"), no validation before cast | `/packages/server/src/adapters/nextjs.ts:59` |
| `POST /api/pay` | `paymentId` | Query string (optional) | Presence check only, no format validation | `/packages/server/src/adapters/nextjs.ts:120` |
| `GET /api/codes/:code/resolve` | `code` | Path parameter | Regex `/^\d{6}$/` validation | `/packages/server/src/handlers.ts:81-83` |
| `GET /api/payments/:id/status` | `paymentId` | Path parameter | Presence check only, **no UUID format validation** | `/packages/server/src/adapters/nextjs.ts:48-51` |

### POST Body Fields (JSON)

#### POST /api/codes/generate
| Field | Type | Validation | Sanitization | File:Line |
|-------|------|------------|--------------|-----------|
| `walletPubkey` | string | Type check + Solana PublicKey constructor | PublicKey validation (base58 decode) | `/packages/server/src/handlers.ts:50-59` |

#### POST /api/payments/create
| Field | Type | Validation | Sanitization | File:Line |
|-------|------|------------|--------------|-----------|
| `amount` | number | Type number, > 0, ≤ 10,000 | None (numeric type) | `/packages/server/src/handlers.ts:130-136` |
| `merchantWallet` | string | Type check + PublicKey constructor | PublicKey validation | `/packages/server/src/handlers.ts:138-146` |

#### POST /api/payments/link
| Field | Type | Validation | Sanitization | File:Line |
|-------|------|------------|--------------|-----------|
| `paymentId` | string | Type check only | None | `/packages/server/src/handlers.ts:169-171` |
| `code` | string | Type check + regex `/^\d{6}$/` | Regex enforces 6 digits | `/packages/server/src/handlers.ts:173-175` |

#### POST /api/pay
| Field | Type | Validation | Sanitization | File:Line |
|-------|------|------------|--------------|-----------|
| `paymentId` | string | Presence check only | None | `/packages/server/src/handlers.ts:280-282` |
| `account` | string | Type check + PublicKey constructor | PublicKey validation | `/packages/server/src/handlers.ts:284-292` |

### HTTP Headers

**Finding:** No custom HTTP headers are processed by the application.

Standard headers used:
- `Content-Type: application/json` (implicit validation via `request.json()`)
- No authentication headers (Bearer, API-Key, etc.)
- No custom business logic headers

### Cookie Values

**Finding:** No cookies are read or processed by the application.

- No session cookies
- No authentication cookies
- No tracking cookies server-side
- Client-side wallet state stored in browser memory only

### File Uploads

**Finding:** No file upload functionality exists in the application.

### WebSocket Messages

**Finding:** No user-controllable WebSocket messages.

**WebSocket Usage (Read-Only):**
- Solana RPC WebSocket subscriptions for account changes
- `connection.onAccountChange(receiptPda, callback)` - `/packages/sdk/src/receipt.ts:90-107`
- Used to monitor receipt PDA creation (payment confirmation)
- **Not user-controllable** - subscriptions are created by application, not from user input

### Client-Side Form Inputs

**Customer Page (/):**

| Component | Field | Endpoint | Validation (Client) | Validation (Server) | File:Line |
|-----------|-------|----------|---------------------|---------------------|-----------|
| Code Display | N/A (read-only) | N/A | Generated by server | N/A | `/src/app/page.tsx:282-340` |

**Merchant Terminal (/merchant):**

| Component | Field | Endpoint | Validation (Client) | Validation (Server) | File:Line |
|-----------|-------|----------|---------------------|---------------------|-----------|
| AmountInput | Fiat amount | `POST /api/payments/create` | Max 8 digits, max 2 decimals, > 0 | Amount > 0, ≤ 10,000 SOL | `/src/components/AmountInput.tsx:68-79` |
| CodeInput | 6-digit code | `POST /api/payments/link` | Regex `/\D/g` removes non-digits, exactly 6 digits | Regex `/^\d{6}$/` | `/src/components/CodeInput.tsx:41, 102` |

### Summary of Input Validation Gaps

**Critical Gaps:**
1. **Payment ID Format:** No UUID validation on `GET /api/payments/:id/status` - accepts any string
2. **Wallet Ownership:** No signature verification on wallet addresses - accepts any valid public key
3. **Code-Payment Ownership:** No validation that requester owns the code or payment being linked
4. **Account-Payment Matching:** No validation that transaction builder's `account` matches payment's `walletPubkey`

**Missing Protections:**
- No rate limiting on any endpoint
- No CSRF tokens
- No input sanitization (relies on type validation only)
- No request size limits
- No timeout enforcement on API calls

---

## 6. Network & Interaction Map

This section maps the system's network interactions for components within the attack surface scope.

### 6.1 Entities

| Title | Type | Zone | Tech | Data | Notes |
|-------|------|------|------|------|-------|
| CustomerBrowser | ExternAsset | Internet | Browser/Wallet Extension | None | Customer's web browser with Solana wallet |
| MerchantBrowser | ExternAsset | Internet | Browser/Wallet Extension | None | Merchant's web browser with Solana wallet |
| NextJsServer | Service | Edge | Next.js 16.2/Node 20+ | Payments, Codes | Main application backend (Vercel serverless) |
| UpstashRedis | DataStore | Data | Redis REST API | PII, Payments | Ephemeral state store (120-300s TTL) |
| SolanaRPC | ThirdParty | ThirdParty | Solana Validator | Public | Devnet RPC endpoint (api.devnet.solana.com) |
| SolanaBlockchain | DataStore | ThirdParty | Solana Devnet | Receipts, Payments | Permanent on-chain storage |
| CoinGeckoAPI | ThirdParty | ThirdParty | REST API | Public | SOL price feed (primary) |
| BinanceAPI | ThirdParty | ThirdParty | REST API | Public | SOL price feed (fallback #1) |
| KrakenAPI | ThirdParty | ThirdParty | REST API | Public | SOL price feed (fallback #2) |
| AnchorProgram | Service | ThirdParty | Rust/Anchor 0.32 | Receipts | Smart contract (program ID: AqdVcH7...mcyNv) |

### 6.2 Entity Metadata

| Title | Metadata |
|-------|----------|
| CustomerBrowser | Interface: `https://solana-blik.vercel.app/`; Wallet: Phantom/Solflare/etc; State: In-memory only |
| MerchantBrowser | Interface: `https://solana-blik.vercel.app/merchant`; Wallet: Phantom/Solflare/etc; State: In-memory only |
| NextJsServer | Hosts: `https://solana-blik.vercel.app`; Endpoints: `/api/codes/*`, `/api/payments/*`, `/api/pay`, `/api/price`; Auth: **NONE**; Dependencies: UpstashRedis, SolanaRPC, CoinGeckoAPI |
| UpstashRedis | URL: `supreme-rattler-78549.upstash.io`; Auth: REST token (exposed in `.env.local`); Protocol: HTTPS REST API; TTLs: codes=120s, payments=300s; Consumers: NextJsServer |
| SolanaRPC | Endpoint: `api.devnet.solana.com`; Protocols: HTTPS, WebSocket; Commitment: `confirmed`; Auth: None (public); Consumers: NextJsServer, CustomerBrowser, MerchantBrowser |
| SolanaBlockchain | Network: Devnet; Consensus: Proof-of-History + Proof-of-Stake; Finality: ~13s (confirmed); Data: Receipt PDAs (permanent) |
| CoinGeckoAPI | Endpoint: `api.coingecko.com/api/v3/simple/price`; Tier: Free (10-50 req/min); Cache: 60s in-memory; Fallbacks: Binance, Kraken, hardcoded prices |
| BinanceAPI | Endpoint: `api.binance.com/api/v3/ticker/price`; Tier: Public; Triggered: When CoinGecko fails |
| KrakenAPI | Endpoint: `api.kraken.com/0/public/Ticker`; Tier: Public; Triggered: When CoinGecko and Binance fail |
| AnchorProgram | Program ID: `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`; Language: Rust; Framework: Anchor 0.32.0; Instruction: `pay(amount, payment_id)`; Network: Devnet only |

### 6.3 Flows (Connections)

| FROM → TO | Channel | Path/Port | Guards | Touches |
|-----------|---------|-----------|--------|---------|
| CustomerBrowser → NextJsServer | HTTPS | `:443 POST /api/codes/generate` | **NONE** | PII (wallet addresses) |
| CustomerBrowser → NextJsServer | HTTPS | `:443 GET /api/codes/:code/resolve` | **NONE** | Codes, Payment metadata |
| CustomerBrowser → NextJsServer | HTTPS | `:443 POST /api/pay` | **NONE** | Payment IDs, wallet addresses |
| MerchantBrowser → NextJsServer | HTTPS | `:443 POST /api/payments/create` | **NONE** | Payment amounts, wallet addresses |
| MerchantBrowser → NextJsServer | HTTPS | `:443 POST /api/payments/link` | **NONE** | Codes, Payment IDs |
| MerchantBrowser → NextJsServer | HTTPS | `:443 GET /api/payments/:id/status` | **NONE** | Payment metadata |
| NextJsServer → UpstashRedis | HTTPS | `:443 REST API (GET/SET/DEL)` | auth:redis-token | PII, Payments, Codes |
| NextJsServer → SolanaRPC | HTTPS | `:443 POST (RPC calls)` | **NONE** | Transactions, Account queries |
| NextJsServer → SolanaRPC | WebSocket | `:443 WSS (account subscriptions)` | **NONE** | Receipt PDA updates |
| NextJsServer → CoinGeckoAPI | HTTPS | `:443 GET /simple/price` | **NONE** | Public |
| NextJsServer → BinanceAPI | HTTPS | `:443 GET /ticker/price` | **NONE** | Public |
| NextJsServer → KrakenAPI | HTTPS | `:443 GET /Ticker` | **NONE** | Public |
| CustomerBrowser → SolanaRPC | HTTPS | `:443 POST (send transaction)` | signature:customer | Signed transactions |
| CustomerBrowser → SolanaRPC | WebSocket | `:443 WSS (receipt subscription)` | **NONE** | Receipt confirmations |
| MerchantBrowser → SolanaRPC | WebSocket | `:443 WSS (receipt subscription)` | **NONE** | Receipt confirmations |
| SolanaRPC → AnchorProgram | On-chain | `instruction: pay` | signature:customer | Transfers SOL, creates receipts |
| AnchorProgram → SolanaBlockchain | On-chain | `Create PDA account` | signature:customer, pda:receipt | Receipt data (permanent) |

### 6.4 Guards Directory

| Guard Name | Category | Statement |
|------------|----------|-----------|
| **NONE** | Auth | **NO AUTHENTICATION** - All API endpoints are publicly accessible without any authentication |
| signature:customer | Auth | Customer wallet must sign transaction with private key (enforced by Solana runtime) |
| auth:redis-token | Network | Upstash Redis REST API requires bearer token in `Authorization` header |
| pda:receipt | Authorization | Receipt PDA derived deterministically from payment_id seed (prevents tampering) |
| status:awaiting_code | Authorization | Payment must have status "awaiting_code" before linking (state machine check) |
| status:linked | Authorization | Payment must have status "linked" before building transaction (state machine check) |
| ttl:120s | RateLimit | Payment codes expire after 120 seconds (automatic cleanup) |
| ttl:300s | RateLimit | Payment records expire after 300 seconds (automatic cleanup) |
| format:pubkey | Network | Input must be valid Solana public key (base58, 32-44 chars) - validation only, not authorization |
| format:6digits | Network | Code must match regex `/^\d{6}$/` - validation only, not authorization |
| format:uuid | Network | **MISSING** - Payment IDs should be validated as UUIDs but are not |
| amount:bounds | Network | Amount must be > 0 and ≤ 10,000 SOL (business logic constraint) |

**Critical Finding:** Only 2 true authorization guards exist:
1. `signature:customer` (blockchain-enforced, cryptographic)
2. `auth:redis-token` (network-level, but token is exposed in repository)

All other "guards" are input validation or state checks, NOT authorization controls.

---

## 7. Role & Privilege Architecture

### 7.1 Discovered Roles

**CRITICAL FINDING:** This application has **NO formal role system**. "Roles" are implicit based on which API endpoints a user calls.

| Role Name | Privilege Level | Scope/Domain | Code Implementation |
|-----------|----------------|--------------|---------------------|
| anonymous | 0 | Global | Default state - can access all API endpoints |
| customer (implicit) | 1 | Global (self-assigned) | Any wallet calling `POST /api/codes/generate` - no registration or validation |
| merchant (implicit) | 1 | Global (self-assigned) | Any wallet calling `POST /api/payments/create` - no registration or validation |

**Note:** Customer and merchant are NOT hierarchical roles - they are parallel, context-based actor types with equal privilege levels.

### 7.2 Privilege Lattice

```
NO FORMAL HIERARCHY EXISTS

Implicit Actor Types (not enforced):
  anonymous → customer (via POST /api/codes/generate)
  anonymous → merchant (via POST /api/payments/create)

Cross-contamination:
  customer ⇄ merchant (same wallet can be both simultaneously)

No isolation:
  Any wallet || Any other wallet (no access controls between users)
```

**Critical Security Issue:** There is no privilege separation. A single wallet address can:
- Generate codes (act as customer)
- Create payment requests (act as merchant)
- Link codes to payments (act as both)
- Build transactions for any payment (no ownership check)

### 7.3 Role Entry Points

| Role | Default Landing Page | Accessible Route Patterns | Authentication Method |
|------|---------------------|---------------------------|----------------------|
| anonymous | `/` or `/merchant` | All routes, all API endpoints | None |
| customer | `/` | All routes, all API endpoints | Wallet connection (optional) |
| merchant | `/merchant` | All routes, all API endpoints | Wallet connection (optional) |

**Note:** Route access is NOT restricted. Anyone can access `/merchant` without being a merchant. Wallet connection is optional for viewing UI but required for submitting transactions.

### 7.4 Role-to-Code Mapping

| Role | Middleware/Guards | Permission Checks | Storage Location |
|------|------------------|-------------------|------------------|
| anonymous | **NONE** | **NONE** | N/A |
| customer | **NONE** | Format validation only (walletPubkey is valid Solana address) | Redis: `code:<6-digits> → {walletPubkey}` (ephemeral, 120s) |
| merchant | **NONE** | Format validation only (merchantWallet is valid Solana address) | Redis: `payment:<uuid> → {merchantWallet}` (ephemeral, 300s) |

**File References:**
- Customer "role" assignment: `/packages/server/src/handlers.ts:44-64` (handleGenerateCode)
- Merchant "role" assignment: `/packages/server/src/handlers.ts:123-151` (handleCreatePayment)
- **No middleware files exist:** `/src/middleware.ts` does not exist
- **No guard decorators:** No `@RequireRole`, `@RequireAuth`, etc.

---

## 8. Authorization Vulnerability Candidates

This section identifies specific endpoints and patterns that are prime candidates for authorization testing.

### 8.1 Horizontal Privilege Escalation Candidates

**Definition:** Accessing another user's resources at the same privilege level.

| Priority | Endpoint Pattern | Object ID Parameter | Data Type | Sensitivity | Attack Vector |
|----------|------------------|---------------------|-----------|-------------|---------------|
| **CRITICAL** | `POST /api/codes/generate` | `walletPubkey` (body) | user_data | **HIGH** | Attacker can generate codes for victim's wallet without owning it. No signature verification. |
| **CRITICAL** | `POST /api/payments/create` | `merchantWallet` (body) | financial | **HIGH** | Attacker can create payment requests impersonating any merchant. No wallet ownership proof. |
| **CRITICAL** | `POST /api/pay` | `account` (body), `paymentId` (query/body) | financial | **HIGH** | Attacker can build transaction for victim's payment using attacker's wallet. No validation that `account` matches `payment.walletPubkey`. |
| **HIGH** | `POST /api/payments/link` | `paymentId` (body), `code` (body) | financial | **HIGH** | Attacker who discovers paymentId + code can link them. No ownership validation. |
| **HIGH** | `GET /api/codes/:code/resolve` | `code` (path param) | payment_metadata | **MEDIUM** | Attacker can enumerate codes (000000-999999) to discover active payments. No rate limiting. |
| **MEDIUM** | `GET /api/payments/:id/status` | `paymentId` (path param) | payment_metadata | **MEDIUM** | Attacker can query any payment status if UUID guessed. Exposes amount, merchant wallet. |

**Exploitation Examples:**

**IDOR-1: Code Generation for Victim Wallet**
```bash
# Attacker generates code for victim's wallet (no signature required!)
curl -X POST https://solana-blik.vercel.app/api/codes/generate \
  -H "Content-Type: application/json" \
  -d '{"walletPubkey": "<VICTIM_WALLET_ADDRESS>"}'

# Response: {"code": "123456", "expiresIn": 120}
# Attacker can now link this code to attacker's merchant payment
```

**IDOR-2: Payment Transaction Hijacking**
```bash
# Victim generates code and merchant links it to payment
# Attacker intercepts paymentId (e.g., from network traffic)

# Attacker builds transaction with THEIR wallet instead of victim's
curl -X POST "https://solana-blik.vercel.app/api/pay" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "<VICTIM_PAYMENT_ID>",
    "account": "<ATTACKER_WALLET>"  # Wrong wallet!
  }'

# Response: Valid transaction that sends SOL from attacker, not victim
# Merchant gets paid but receipt shows wrong customer
```

### 8.2 Vertical Privilege Escalation Candidates

**Definition:** Gaining higher privileges than intended.

**FINDING:** Not applicable - no privilege hierarchy exists.

The application has no admin role, no elevated privileges, and no restricted functionality. All endpoints are equally accessible to everyone.

**Potential Vertical Escalation (if roles existed):**
- N/A - no target role to escalate to
- N/A - no admin panel or privileged endpoints

### 8.3 Context-Based Authorization Candidates

**Definition:** Bypassing multi-step workflows by skipping required prior steps.

| Workflow | Endpoint | Expected Prior State | Bypass Potential | Risk Level |
|----------|----------|---------------------|------------------|------------|
| Payment Flow | `POST /api/payments/link` | Code must be generated by customer, payment created by merchant | Attacker can call link endpoint with any code/payment combo if they know the values | **HIGH** |
| Transaction Building | `POST /api/pay` | Payment must be linked (status="linked") | Status check exists but no validation of WHO is requesting the transaction | **CRITICAL** |
| Payment Confirmation | Blockchain `pay` instruction | Transaction should be built by legitimate customer | Smart contract validates customer signature but NOT merchant address | **CRITICAL** |

**Workflow Bypass Example:**

**Bypass-1: Skip Code Generation**
```bash
# Normal flow: Customer generates code → Merchant links code → Customer approves
# Attacker bypass: Brute force codes to find active one

for code in {000000..999999}; do
  response=$(curl -s "https://solana-blik.vercel.app/api/codes/$code/resolve")
  if echo "$response" | grep -q "linked"; then
    echo "Found active code: $code"
    # Extract paymentId and hijack payment
  fi
done
```

**Bypass-2: Direct Transaction Building**
```bash
# Attacker skips entire code generation flow
# Discovers paymentId through enumeration or interception
# Directly builds transaction

curl -X POST "https://solana-blik.vercel.app/api/pay" \
  -d '{"paymentId": "<discovered_id>", "account": "<attacker_wallet>"}'

# Success - transaction built without customer's consent
```

### 8.4 Object Ownership Validation Gaps

**Complete List of Missing Ownership Checks:**

| Endpoint | Object | Owner Field | Missing Validation | Impact |
|----------|--------|-------------|-------------------|--------|
| `POST /api/codes/generate` | Code | `walletPubkey` | No proof requester owns the wallet | Can generate codes for any wallet |
| `POST /api/payments/create` | Payment | `merchantWallet` | No proof requester owns the wallet | Can create payments for any merchant |
| `POST /api/payments/link` | Code + Payment | `code.walletPubkey`, `payment.merchantWallet` | No proof requester owns either | Can link any code to any payment |
| `POST /api/pay` | Payment | `payment.walletPubkey` | No proof `account` parameter matches owner | Can build transaction for any payment |
| `GET /api/payments/:id/status` | Payment | `merchantWallet` | No access control | Information disclosure |
| `GET /api/codes/:code/resolve` | Code | `walletPubkey` | No access control | Information disclosure |

**File Location for Fixes:**
All missing checks should be added to `/packages/server/src/handlers.ts` in respective handler functions.

---

## 9. Injection Sources

**Network Surface Focus:** Only injection sources accessible through network requests to the deployed application are included.

### Summary: NO CRITICAL INJECTION VULNERABILITIES FOUND

After comprehensive analysis of all network-accessible code paths, the application demonstrates good security practices regarding injection prevention:

- ✅ **SQL Injection:** Not applicable (no SQL database - uses Redis key-value store)
- ✅ **Command Injection:** Not vulnerable (no shell command execution from user input)
- ✅ **Path Traversal/LFI/RFI:** Not vulnerable (no file system operations based on user input)
- ✅ **SSTI:** Not vulnerable (no template engines or dynamic template rendering)
- ✅ **Deserialization:** Safe (proper validation on JSON.parse)
- ⚠️ **NoSQL Injection (Redis):** Low risk (one endpoint lacks UUID validation)

### 9.1 Command Injection Sources

**Status:** ✅ NOT VULNERABLE

**Analysis:** No shell commands (`exec`, `spawn`, `child_process`) are executed in network-accessible code.

**Files Checked:**
- `/packages/server/src/handlers.ts` - No command execution
- `/packages/server/src/storage.ts` - No command execution
- `/packages/server/src/adapters/nextjs.ts` - No command execution
- `/packages/sdk/src/**` - Client-side code only

### 9.2 SQL Injection Sources

**Status:** ✅ NOT APPLICABLE

**Analysis:** Application uses Redis (key-value store), not a SQL database.

**Storage Implementation:** `/packages/server/src/storage.ts`
- Operations: `store.get(key)`, `store.set(key, value, ttl)`, `store.del(key)`
- No query builders, no SQL strings, no ORM

### 9.3 Path Traversal / LFI / RFI Sources

**Status:** ✅ NOT VULNERABLE

**Analysis:** No file system operations based on user input in network-accessible code.

**Files Checked:**
- No `fs.readFile`, `fs.writeFile`, `require()`, or `import()` with user input
- All file operations are in build-time code (not network-accessible)

### 9.4 Server-Side Template Injection (SSTI) Sources

**Status:** ✅ NOT VULNERABLE

**Analysis:** No template engines used. Application is a JSON API with React frontend.

**No Dangerous Patterns Found:**
- No `eval()` on user input
- No `Function()` constructor with user strings
- No template engines (ejs, pug, handlebars, etc.)

### 9.5 Deserialization Sources

**Status:** ✅ SAFE (with proper validation)

**Source Location:** `/packages/server/src/adapters/nextjs.ts:97`

```typescript
const body = await request.json();
```

**Data Flow Analysis:**

All POST endpoints use `request.json()` but properly validate inputs:

1. **POST /api/codes/generate**
   - Input: `{ walletPubkey: string }`
   - Validation: Type check + Solana PublicKey constructor (throws if invalid)
   - File: `/packages/server/src/handlers.ts:50-59`
   - ✅ Safe

2. **POST /api/payments/create**
   - Input: `{ amount: number, merchantWallet: string }`
   - Validation: Type checks + amount bounds + PublicKey validation
   - File: `/packages/server/src/handlers.ts:130-146`
   - ✅ Safe

3. **POST /api/payments/link**
   - Input: `{ paymentId: string, code: string }`
   - Validation: Type checks + regex `/^\d{6}$/` on code
   - File: `/packages/server/src/handlers.ts:169-175`
   - ✅ Safe

4. **POST /api/pay**
   - Input: `{ paymentId: string, account: string }`
   - Validation: Presence checks + PublicKey validation on account
   - File: `/packages/server/src/handlers.ts:280-292`
   - ✅ Safe

**UUID Parsing (Controlled):**
- File: `/packages/sdk/src/uuid.ts:1-9`
- Function: `uuidToBytes(uuid: string)`
- Validation: Length check (must be 32 hex chars after removing hyphens)
- Uses `parseInt(hex, 16)` with fixed radix
- ✅ Safe

### 9.6 NoSQL Injection (Redis)

**Status:** ⚠️ LOW RISK (one endpoint lacks validation)

**Redis Key Construction Patterns:**

All Redis keys use string interpolation:

1. **Code Keys:** `code:${code}`
   - Validation: Regex `/^\d{6}$/` enforced before use
   - File: `/packages/server/src/storage.ts:122`
   - ✅ Safe

2. **Payment Keys:** `payment:${paymentId}`
   - Creation: Uses `crypto.randomUUID()` (server-generated)
   - File: `/packages/server/src/storage.ts:185`
   - ✅ Safe (when creating)

3. **Payment Lookup:** `payment:${paymentId}`
   - **Issue:** GET endpoint accepts any string as paymentId
   - File: `/packages/server/src/adapters/nextjs.ts:48-51`
   - ⚠️ **VULN-001: Missing UUID format validation**

**VULN-001 Details:**

**Endpoint:** `GET /api/payments/:id/status`

**Source:**
```typescript
// File: /packages/server/src/adapters/nextjs.ts:48-51
const statusMatch = path.match(/\/payments\/([^/]+)\/status$/);
if (statusMatch) {
  const result = await handlers.handlePaymentStatus(ctx, {
    paymentId: statusMatch[1],  // No validation!
  });
}
```

**Flow to Sink:**
```typescript
// File: /packages/server/src/handlers.ts:240
const payment = await getPayment(ctx.store, paymentId);

// File: /packages/server/src/storage.ts:198
return store.get<PaymentData>(`payment:${paymentId}`);
```

**Risk Assessment:**
- **Severity:** LOW
- **Impact:** Information disclosure only (read-only operation)
- **Limitation:** Invalid keys return null → 404 response
- **Exploitation:** Attacker could try to enumerate keys, but:
  - UUIDs have 128 bits of entropy (infeasible to guess)
  - Keys expire after 300 seconds
  - No Redis command injection possible (SDK uses REST API with JSON serialization)

**Recommendation:** Add UUID format validation:
```typescript
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
  throw new BlikError("Invalid payment ID format", 400);
}
```

4. **Reference Keys:** `ref:${reference}`
   - Value: Solana public key (base58, generated by server)
   - File: `/packages/server/src/storage.ts:235`
   - ✅ Safe (server-controlled value)

### 9.7 Prototype Pollution

**Status:** ✅ NOT VULNERABLE

**Analysis:**
- No use of unsafe `Object.assign()` or spread operators with untrusted objects
- No recursive merge functions
- No lodash `merge()` on user input
- All object updates use explicit field assignment

**Example Safe Pattern:**
```typescript
// File: /packages/server/src/storage.ts:214-219
await store.set(
  `payment:${paymentId}`,
  { ...payment, ...updates },  // Safe - updates is controlled object
  remainingTtl
);
```

### 9.8 SSRF (Server-Side Request Forgery)

**Status:** ✅ NOT VULNERABLE

**External HTTP Requests Analysis:**

All fetch URLs are hardcoded constants, not user-controlled:

1. **CoinGecko:** `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur`
   - File: `/packages/server/src/price.ts:31`
   - ✅ Hardcoded URL

2. **Binance:** `https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT`
   - File: `/src/lib/price.ts:26`
   - ✅ Hardcoded URL
   - Note: Client-side only (runs in browser, not server)

3. **Kraken:** `https://api.kraken.com/0/public/Ticker?pair=SOLUSD`
   - File: `/src/lib/price.ts:46`
   - ✅ Hardcoded URL
   - Note: Client-side only

**No user input influences any fetch() URL.**

### Summary Table

| Injection Type | Status | Risk Level | Finding |
|---------------|--------|------------|---------|
| SQL Injection | Not Applicable | N/A | No SQL database used |
| Command Injection | Not Vulnerable | None | No shell execution in network code |
| Path Traversal | Not Vulnerable | None | No file operations on user input |
| SSTI | Not Vulnerable | None | No template engines |
| Deserialization | Safe | None | Proper JSON validation |
| NoSQL Injection | Minor Issue | **LOW** | One endpoint lacks UUID validation (VULN-001) |
| Prototype Pollution | Not Vulnerable | None | Safe object patterns |
| SSRF | Not Vulnerable | None | All URLs hardcoded |

**Critical for Next Phases:**
- Injection Analysis Specialist: Focus on VULN-001 (payment ID validation gap)
- All other injection vectors are properly mitigated
- Primary attack surface is **authorization**, not injection

