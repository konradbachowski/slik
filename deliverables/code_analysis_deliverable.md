# SolanaBLIK Security Assessment - Code Analysis Report

**Assessment Date:** 2026-03-21
**Application:** SolanaBLIK - Solana BLIK-style Payment Gateway
**Application URL:** https://solana-blik.vercel.app
**Architecture:** Next.js 16.2.0 + Solana Anchor + Upstash Redis
**Environment:** Devnet (Development/Testing)
**Analysis Scope:** Complete source code security review from external attacker perspective

---

# Penetration Test Scope & Boundaries

**Primary Directive:** This analysis is strictly limited to the **network-accessible attack surface** of the application. All findings reported meet the "In-Scope" criteria defined below.

## In-Scope: Network-Reachable Components

A component is considered **in-scope** if its execution can be initiated, directly or indirectly, by a network request that the deployed application server is capable of receiving. This includes:

- **Publicly exposed web pages and API endpoints** - All 8 REST API endpoints and 2 web pages
- **Endpoints requiring authentication via the application's standard login mechanisms** - Wallet-based authentication through Solana wallet adapters
- **Any developer utility, debug console, or script** that has been mistakenly exposed through a route or is otherwise callable from other in-scope, network-reachable code

## Out-of-Scope: Locally Executable Only

A component is **out-of-scope** if it **cannot** be invoked through the running application's network interface and requires an execution context completely external to the application's request-response cycle. This includes tools that must be run via:

- Command-line interface (e.g., `anchor build`, `npm run dev`)
- Development environment's internal tooling (e.g., "run script" button in an IDE)
- CI/CD pipeline scripts or build tools
- Database migration scripts, backup tools, or maintenance utilities
- Local development servers, test harnesses, or debugging utilities
- Static files or scripts that require manual opening in a browser (not served by the application)

**Note:** Build artifacts in `/programs/solanablik/target/`, development configuration files, and local testing utilities are explicitly excluded from this analysis.

---

## 1. Executive Summary

The SolanaBLIK application is a **proof-of-concept Web3 payment gateway** that implements a BLIK-style instant payment system on the Solana blockchain. This analysis reveals a **high-risk security posture** with critical vulnerabilities that make the application unsuitable for production deployment without significant hardening.

### Critical Security Findings

The application exposes **4 CRITICAL** and **5 HIGH** severity vulnerabilities across authentication, authorization, cryptography, and infrastructure layers. Most significantly, the application operates with **zero traditional authentication mechanisms** on its API endpoints, relying solely on client-side wallet signatures for transaction authorization. This design creates multiple attack vectors including code enumeration, payment hijacking via race conditions, and unlimited brute-force attempts against the 6-digit payment code system.

### Architecture Security Posture

From an external attacker perspective with no privileged access, the application presents **11 network-accessible entry points** (8 REST APIs, 1 blockchain instruction, 2 web interfaces) all of which lack rate limiting, input sanitization schemas, or authentication middleware. The use of `Math.random()` for generating payment codes instead of cryptographically secure randomness creates a predictable attack surface with only 900,000 possible combinations within a 120-second window. Additionally, production Redis credentials are committed to the `.env.local` file, potentially exposing the entire payment database if the repository is compromised.

### Operational Readiness Assessment

The application is currently configured for **Solana Devnet only** and demonstrates development-grade security controls. Key missing production safeguards include: comprehensive security headers (CSP, X-Frame-Options, HSTS), request body size limits, CORS configuration, API versioning, and monitoring/alerting infrastructure. While the blockchain transaction logic demonstrates sound cryptographic practices using Ed25519 signatures and PDA-based receipt generation, the surrounding API layer lacks the defense-in-depth necessary for handling real financial transactions. **This application must not be deployed to Solana mainnet or handle real funds without addressing all critical and high-severity findings.**

---

## 2. Architecture & Technology Stack

### Framework & Language

The SolanaBLIK application is built on **Next.js 16.2.0** with the App Router architecture, utilizing **React 19.2.4** with experimental React Compiler features enabled. The application is written entirely in **TypeScript 5.x** with strict mode enabled, providing compile-time type safety across the codebase. This technology choice demonstrates modern web development practices but introduces risks associated with bleeding-edge framework features—React 19 and the React Compiler are recent releases that may contain undiscovered vulnerabilities.

**Security Implications:** TypeScript's strict mode provides good protection against type-related bugs, but the codebase lacks runtime validation schemas (e.g., Zod, Yup) to enforce input contracts at API boundaries. The experimental React Compiler feature (`reactCompiler: true` in `/Users/mac/kodziki/apps/solana-blik/next.config.ts`) could introduce unexpected behavior in production. Most critically, Next.js configuration shows **no security header definitions**, **no Content Security Policy**, and **no CORS restrictions**—leaving the application vulnerable to clickjacking, XSS, and cross-origin attacks.

### Architectural Pattern

The application implements a **hybrid Web3 architecture** combining traditional serverless computing (Vercel Functions) with blockchain-native operations (Solana smart contracts). The architecture can be classified as a **monolithic frontend with serverless backend and blockchain microservice pattern**.

**Trust Boundaries:** The application defines three distinct trust zones:
1. **Client Zone** - Next.js frontend pages at `/` (customer) and `/merchant` (merchant terminal), where users interact through browser-based Solana wallet extensions
2. **API Zone** - 8 serverless API routes hosted on Vercel that orchestrate payment flows, generate codes, and build unsigned transactions
3. **Blockchain Zone** - Anchor smart contract deployed to Solana Devnet (Program ID: `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`) that executes atomic SOL transfers

**Critical Security Architecture Flaw:** The trust boundary between Client and API zones is **completely undefended**—all API endpoints accept unauthenticated requests with no rate limiting. An attacker can enumerate payment codes, create unlimited fake payments, or poll payment status for any UUID without restriction. The only enforced boundary is between API and Blockchain zones, where Solana's consensus mechanism validates transaction signatures, but this protection occurs too late to prevent abuse of the API layer.

### Critical Security Components

The application's security model relies on five key components, three of which demonstrate significant weaknesses:

**1. Wallet-Based Authentication (⚠️ Partial)**
- **Implementation:** `@solana/wallet-adapter-react` v0.15.39 in `/Users/mac/kodziki/apps/solana-blik/src/components/WalletProvider.tsx`
- **Mechanism:** Client-side wallet signature verification with auto-connect enabled (line 24)
- **Weakness:** Authentication only enforced for blockchain transactions, not API access. An attacker without a wallet can still generate codes, create payments, and link codes to payments.

**2. Ephemeral State Management (🔴 Critical Vulnerability)**
- **Implementation:** Upstash Redis with 120s code TTL and 300s payment TTL in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts`
- **Weakness:** Production credentials hardcoded in `.env.local` (lines 9-10): `UPSTASH_REDIS_REST_URL=https://supreme-rattler-78549.upstash.io` and plaintext token. If repository is compromised, attacker gains full database access.
- **Additional Risk:** Fallback to in-memory storage for development (lines 63-91) could accidentally deploy to production without persistence.

**3. Code Generation (🔴 Critical Vulnerability)**
- **Implementation:** `Math.random()` used to generate 6-digit codes in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts:110-113`
- **Weakness:** Non-cryptographic PRNG with only 900,000 possible values (100000-999999). Given 120s TTL and no rate limiting, an attacker can brute-force active codes by polling `/api/codes/[code]/resolve` at ~7,500 requests/second to enumerate all codes within the expiration window.

**4. Transaction Authorization (✅ Strong)**
- **Implementation:** Solana transaction signing via wallet adapter with PDA (Program Derived Address) based receipts
- **Strength:** Private keys never leave wallet extension. Transaction signatures use Ed25519 cryptography. Receipt PDAs use deterministic derivation with payment UUID seeds, preventing replay attacks.

**5. Price Oracle Integration (⚠️ Moderate Risk)**
- **Implementation:** CoinGecko API at `/Users/mac/kodziki/apps/solana-blik/src/lib/price.ts` with 60s cache
- **Weakness:** Single source of truth for SOL/fiat conversion with hardcoded fallback prices (USD: 140, PLN: 560, EUR: 130 at line 36). No multi-source validation. An attacker who can manipulate CoinGecko responses (DNS hijacking, BGP attacks) or induce API failures could force incorrect payment amounts.

---

## 3. Authentication & Authorization Deep Dive

### Authentication Mechanisms and Security Properties

The SolanaBLIK application implements a **Web3-native authentication model** that fundamentally deviates from traditional username/password or JWT-based systems. Authentication is exclusively provided through **Solana wallet signatures** via the `@solana/wallet-adapter-react` library (v0.15.39), with no traditional login endpoints, session cookies, or OAuth flows.

**Complete Authentication API Endpoint Inventory:** The application contains **ZERO traditional authentication endpoints**. There are no login, logout, token refresh, password reset, MFA enrollment, or account recovery endpoints. User identity is established entirely through wallet public key ownership, verified cryptographically through message signatures when submitting blockchain transactions. However, this authentication only applies to transaction execution—the surrounding API infrastructure is completely unauthenticated.

**Wallet Provider Implementation Analysis:**
The authentication mechanism is initialized in `/Users/mac/kodziki/apps/solana-blik/src/components/WalletProvider.tsx` (lines 1-29). The component wraps the application in Solana wallet adapter contexts:

```typescript
<ConnectionProvider endpoint={RPC_ENDPOINT}>
  <SolanaWalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>{children}</WalletModalProvider>
  </SolanaWalletProvider>
</ConnectionProvider>
```

**Critical Security Configuration:** Line 24 enables `autoConnect={true}`, which automatically reconnects previously used wallets on page load. While convenient for UX, this creates a **phishing attack vector**—a malicious site using similar UI could trick users into auto-connecting their wallets and signing malicious transactions.

**Supported Wallet Types:** The application supports Phantom and Solflare wallets explicitly, plus any wallet implementing the Wallet Standard (detected via `getWallets()`). No wallet reputation checks or malicious wallet detection exists—any wallet extension can interact with the application.

### Session Management and Token Security

**Session Storage Architecture:** Unlike traditional web applications, SolanaBLIK does not use HTTP sessions. Instead, it maintains **ephemeral payment state** in Upstash Redis with aggressive TTLs:
- **Payment codes:** 120 seconds (2 minutes) - stored as `code:{6digits}` keys
- **Payment records:** 300 seconds (5 minutes) - stored as `payment:{uuid}` keys

**Critical Finding - No Cookie Configuration:** The application does **NOT** use session cookies, therefore there are no `HttpOnly`, `Secure`, or `SameSite` flag configurations to audit. This is both a strength (no cookie-based attacks possible) and a weakness (no server-maintained session state to enforce authorization).

**Session State Location Analysis:**
All session management logic resides in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts`:
- Lines 43-47: Redis client initialization with environment-based credentials
- Lines 30-31: TTL constants defining session lifetimes (`CODE_TTL = 120`, `PAYMENT_TTL = 300`)
- Lines 63-91: Fallback in-memory storage with TTL pruning for development environments

**Security Implication:** The short TTL approach limits attacker windows but creates poor user experience—codes expire in 2 minutes, forcing rushed interactions. More critically, there is **no session invalidation API**—once a code is generated, it cannot be revoked before expiration, even if the user suspects compromise.

### Authorization Model and Bypass Scenarios

**Authorization Architecture:** The application implements a **stateless, pseudo-public authorization model** with no role-based access control (RBAC), attribute-based access control (ABAC), or permission validators. Every API endpoint accepts unauthenticated requests, relying on implicit authorization through knowledge of payment IDs, codes, or wallet addresses.

**Comprehensive API Authorization Audit:**

**1. `/api/codes/generate` (POST) - UNAUTHENTICATED**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/generate/route.ts`
- **Authorization Check:** NONE - Anyone can generate codes for ANY Solana wallet address
- **Bypass Scenario:** Attacker generates codes for victim's wallet, causing confusion or denial of service by code exhaustion
- **Validation:** Lines 10-25 validate Solana public key format only:
```typescript
if (!walletPubkey || typeof walletPubkey !== "string") {
  return Response.json({ error: "Missing or invalid walletPubkey." }, { status: 400 });
}
try {
  new PublicKey(walletPubkey);
} catch {
  return Response.json({ error: "Invalid Solana public key format." }, { status: 400 });
}
```

**2. `/api/codes/[code]/resolve` (GET) - UNAUTHENTICATED**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/[code]/resolve/route.ts`
- **Authorization Check:** NONE - Public polling endpoint
- **Bypass Scenario:** Attacker brute-forces all 6-digit combinations (100000-999999) to discover active payment codes, then races to link them to attacker-controlled payment IDs
- **Rate Limiting:** ABSENT - Unlimited requests allowed

**3. `/api/payments/create` (POST) - UNAUTHENTICATED**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/create/route.ts`
- **Authorization Check:** NONE - Anyone can create payments for any merchant wallet
- **Bypass Scenario:** Attacker creates thousands of fake payments to inflate merchant's "pending payment" count or exhaust Redis storage
- **Amount Limit:** 10,000 SOL maximum (line 17-22), but no per-user or global rate limit

**4. `/api/payments/link` (POST) - RACE CONDITION VULNERABILITY**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/link/route.ts`
- **Authorization Check:** State validation only (payment must be in "awaiting_code" status)
- **CRITICAL BYPASS:** Lines 45-78 contain a **time-of-check-to-time-of-use (TOCTOU) race condition**:
```typescript
// Line 45: Check if payment is awaiting code
if (payment.status !== "awaiting_code") {
  return Response.json({ error: `Payment cannot be linked. Current status: ${payment.status}` }, { status: 409 });
}
// Lines 53-78: Multiple async operations before state update
const codeData = await getCode(code);
// ... Receipt PDA generation ...
// ... Finally update payment state (TOO LATE)
await updatePayment(paymentId, { status: "linked", code, walletPubkey, reference: receiptPda.toBase58() });
```
**Exploitation:** Two merchants enter the same customer code simultaneously. Both pass the status check, both link the code, but only one transaction can succeed on-chain. The other merchant sees "linked" status but funds go to the first merchant.

**5. `/api/pay` (POST) - UNAUTHENTICATED TRANSACTION BUILDER**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/pay/route.ts`
- **Authorization Check:** State validation only (payment must be "linked")
- **Bypass Scenario:** Attacker who discovers a linked paymentId (via UUID enumeration or timing attacks) can request the transaction template, though they cannot sign it without the customer's private key

**6. `/api/payments/[id]/status` (GET) - INFORMATION DISCLOSURE**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/[id]/status/route.ts`
- **Authorization Check:** NONE - Anyone can query any payment by UUID
- **Bypass Scenario:** Attacker iterates through UUID space (particularly predictable UUIDs if `uuid` library has weak entropy) to enumerate all payments, revealing transaction amounts and wallet addresses

### Multi-Tenancy Security Implementation

**Finding:** The application does **NOT implement multi-tenancy** in the traditional SaaS sense. Each payment is an isolated transaction with no concept of "tenants," "organizations," or "accounts."

**Pseudo-Tenancy Model:** Merchants and customers are distinguished only by their role in a specific payment flow:
- **Customer:** Wallet that generates payment code
- **Merchant:** Wallet specified in payment creation

**Isolation Mechanism:** Payment isolation relies entirely on:
1. **UUID randomness** for payment IDs (using `uuid` v13.0.0 library)
2. **Code uniqueness** (6-digit codes stored with unique Redis keys)
3. **Blockchain finality** (once paid, receipt PDA is immutable)

**Cross-Tenant Attack Vectors:**
- **Code guessing:** Customer A's code could be linked to Merchant B's payment
- **Payment enumeration:** No access controls prevent querying other users' payments
- **Wallet spoofing:** Merchant could specify victim's wallet as recipient, tricking them into approving payment

### SSO/OAuth/OIDC Flows

**Finding:** **ZERO SSO/OAuth/OIDC implementations exist** in this application.

**No OAuth Callback Endpoints:** No routes matching `/auth/callback`, `/oauth/redirect`, or similar patterns
**No State/Nonce Validation:** Not applicable—no OAuth flows implemented
**No Token Exchange:** The application does not integrate with identity providers (Google, GitHub, Auth0, etc.)

**Architecture Rationale:** Web3 applications replace traditional identity providers with blockchain-based identity (wallet public keys). The Solana wallet itself acts as both the authentication provider and authorization token—the private key serves as the "password," and signatures serve as "session tokens."

**Security Trade-off:** This eliminates entire vulnerability classes (OAuth token theft, redirect URI manipulation) but introduces new risks (wallet extension compromise, transaction signature phishing).

---

## 4. Data Security & Storage

### Database Security

The SolanaBLIK application uses **Upstash Redis** as its primary data store, with a fallback to in-memory storage for development environments. Unlike traditional SQL databases, Redis operates as a key-value store, eliminating SQL injection attack vectors but introducing different security considerations around access control, encryption, and data isolation.

**Database Access Control Analysis:**
Redis credentials are configured in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts` (lines 43-47):
```typescript
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

**🔴 CRITICAL VULNERABILITY - Exposed Credentials:** The `.env.local` file contains production Redis credentials in plaintext:
- **URL:** `https://supreme-rattler-78549.upstash.io`
- **Token:** `gQAAAAAAATLVAAIncDE0ODM2YjUwMTFkYmM0M2EwOTgxNGNjZDc1YjE4MWYwZnAxNzg1NDk=`

These credentials provide **full read/write access** to the payment database. If the repository is public or compromised, an attacker can:
1. Read all active payment codes and link them to attacker-controlled payments
2. Modify payment amounts, statuses, or recipient wallet addresses
3. Delete payments to cause denial of service
4. Inject fake payments or codes to disrupt operations

**Encryption at Rest:** Upstash Redis provides encryption at rest on their infrastructure, but the application **does NOT implement application-layer encryption**. All payment data is stored in plaintext:
- Customer wallet addresses (Solana public keys)
- Merchant wallet addresses
- Payment amounts in SOL
- 6-digit payment codes
- Payment IDs (UUIDs)

An attacker with database access can directly read all sensitive information without needing to decrypt it.

**Query Safety:** Since Redis is a key-value store using parameterized REST API calls, there are no SQL injection vulnerabilities. All operations use typed methods:
- `redis.setex(key, ttl, value)` - Set with expiration
- `redis.get(key)` - Get value
- `redis.del(key)` - Delete key

However, **no input sanitization** occurs before using user-provided values as Redis keys. For example, in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts:109`, the code is directly interpolated into the key:
```typescript
await redis.setex(`code:${code}`, CODE_TTL, JSON.stringify(codeData));
```
If the code generation algorithm is compromised, an attacker could inject special characters into keys to cause key collisions or enumeration.

### Data Flow Security

**Payment Flow Data Tracing:**

**Stage 1 - Code Generation (Customer Initiates):**
- **Input:** Customer wallet public key (from wallet adapter)
- **API:** POST `/api/codes/generate` with body `{ walletPubkey: string }`
- **Storage:** Creates Redis key `code:123456` → `{ walletPubkey, createdAt }` (120s TTL)
- **Exposure Risk:** Wallet address stored in plaintext, linkable to code via enumeration

**Stage 2 - Payment Creation (Merchant Initiates):**
- **Input:** Amount (SOL), merchant wallet public key
- **API:** POST `/api/payments/create` with body `{ amount: number, merchantWallet: string }`
- **Processing:** UUID generated using `uuid` library (v13.0.0)
- **Storage:** Creates Redis key `payment:{uuid}` → `{ amount, merchantWallet, status: "awaiting_code", createdAt }` (300s TTL)
- **Exposure Risk:** Payment amount and merchant identity stored before customer authorization

**Stage 3 - Code Linking (Merchant Provides Customer Code):**
- **Input:** Payment ID (UUID), 6-digit code
- **API:** POST `/api/payments/link` with body `{ paymentId: string, code: string }`
- **Processing:** Retrieves code data, retrieves payment data, derives receipt PDA
- **Storage:** Updates `payment:{uuid}` → adds `{ code, walletPubkey, reference, status: "linked" }`
- **Exposure Risk:** 🔴 **RACE CONDITION** - Multiple merchants can link same code during multi-step update process (lines 45-78 in `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/link/route.ts`)

**Stage 4 - Transaction Execution (Customer Approves):**
- **Input:** Payment ID, customer wallet (from wallet adapter)
- **API:** POST `/api/pay?paymentId={uuid}` with body `{ account: string }`
- **Processing:** Builds unsigned Solana transaction using Anchor instruction format
- **Response:** Returns base64-encoded transaction for client-side signing
- **Blockchain:** Customer wallet signs transaction, broadcasts to Solana RPC
- **Confirmation:** Receipt PDA created on-chain with payment details
- **Cleanup:** Payment status updated to "paid" (lazily, when `/api/payments/[id]/status` is next called)

**Data Protection Gaps:**
1. **No encryption in transit beyond HTTPS** - Application relies on Vercel's TLS, no additional layer
2. **No data masking in logs** - Console.log statements exist in development code (not production concern, but worth noting)
3. **No PII anonymization** - Wallet addresses (considered PII under GDPR) stored without hashing or tokenization
4. **No audit trail** - Redis lacks built-in audit logging; no record of who accessed payment data

### Multi-Tenant Data Isolation

**Data Isolation Model:** As noted in Section 3, the application does not implement true multi-tenancy. However, payment data must be isolated between users to prevent one merchant or customer from accessing another's payments.

**Current Isolation Mechanisms:**

**1. UUID-Based Isolation:**
Payment IDs use UUID v4 (122 bits of entropy), making payment enumeration computationally infeasible via random guessing. However:
- **Weakness:** `/api/payments/[id]/status` has no authentication—anyone with a payment ID can query its status
- **Attack Vector:** Timing attacks during payment creation could reveal sequential patterns if UUID generation has weak entropy
- **Validation:** The `uuid` library (v13.0.0) uses Node.js `crypto.randomUUID()` which is cryptographically secure

**2. Code Namespace Isolation:**
6-digit codes exist in a flat namespace (`code:000000` through `code:999999`). No user-specific prefixing or scoping exists.
- **Weakness:** Code collisions are theoretically possible if two users generate the same 6-digit random number simultaneously
- **Probability:** With 900,000 possible codes and 120s TTL, collision probability is low but non-zero under high load
- **No Collision Handling:** If collision occurs, the second user's code overwrites the first user's data without warning (lines 109-113 in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts`)

**3. On-Chain Isolation:**
Receipt PDAs use deterministic derivation: `["receipt", paymentId_bytes]`
- **Strength:** Each payment ID maps to exactly one receipt PDA address, preventing cross-payment contamination
- **Blockchain Enforcement:** Solana consensus ensures only one receipt per payment can exist
- **Immutability:** Once created, receipts cannot be modified or deleted

**Cross-Tenant Attack Scenarios:**
- **Scenario 1:** Merchant A discovers Merchant B's payment UUID (via timing, logs, or interception) and polls `/api/payments/[id]/status` to spy on revenue
- **Scenario 2:** Customer A's code (e.g., "123456") is linked to Merchant B's payment instead of the intended Merchant A due to race condition
- **Scenario 3:** Attacker generates codes with same random seed as legitimate user, causing code overwrite and DoS

**Recommended Isolation Improvements:**
1. Add wallet signature requirements to API endpoints to enforce "owns wallet, can access payment"
2. Prefix codes with wallet address hash: `code:{walletHash}:{6digits}` to prevent cross-user code access
3. Implement atomic compare-and-swap for payment linking to prevent race conditions
4. Add access control lists (ACLs) in Redis: store `payment:{uuid}:owner` → `walletAddress` and validate on each access

---

## 5. Attack Surface Analysis

### External Entry Points - Network-Accessible Interfaces

The SolanaBLIK application exposes **11 network-accessible entry points** across three layers: REST API (8 endpoints), blockchain interface (1 instruction), and web UI (2 pages). All components meet the in-scope criteria as they are directly invokable through the deployed Vercel application at `https://solana-blik.vercel.app`.

**REST API Layer - 8 Endpoints (All Unauthenticated):**

**1. POST `/api/codes/generate` - Code Generation Endpoint**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/generate/route.ts`
- **Input Vector:** JSON body `{ walletPubkey: string }`
- **Attack Surface:** Accepts any valid Solana public key, generates 6-digit code using `Math.random()`
- **Validation:** Lines 10-25 validate public key format only
- **Exploitation Potential:**
  - **DoS:** Unlimited code generation can exhaust Redis storage or cause rate limiting on Upstash free tier
  - **Code Prediction:** `Math.random()` seed could be predicted with server timing analysis
  - **Privacy Leak:** Reveals code expiration times, allowing timing attacks on active wallets

**2. GET `/api/codes/[code]/resolve` - Code Status Polling**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/[code]/resolve/route.ts`
- **Input Vector:** URL parameter `[code]` (6 digits)
- **Attack Surface:** 900,000 possible code values (100000-999999)
- **Validation:** Regex `/^\d{6}$/` (line 23)
- **Exploitation Potential:**
  - **Brute Force:** With no rate limiting, attacker can enumerate all active codes in seconds (900k requests at 1000 req/s = 15 minutes)
  - **Code Sniping:** Once discovered, attacker can race to link code to attacker's payment before legitimate merchant
  - **Timing Analysis:** Response times differ for expired vs. active codes, leaking code existence

**3. POST `/api/payments/create` - Payment Initialization**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/create/route.ts`
- **Input Vectors:** JSON body `{ amount: number, merchantWallet: string }`
- **Attack Surface:** Amount range 0.000000001 to 10,000 SOL
- **Validation:** Lines 10-38 check amount positivity, maximum, and wallet format
- **Exploitation Potential:**
  - **Spam:** Unlimited payment creation exhausts Redis storage (300s TTL × creation rate)
  - **Enumeration:** Predictable UUID generation (if flawed) allows payment discovery
  - **Economic Grief:** Attacker creates 10,000 SOL payments for victim merchants, causing confusion

**4. POST `/api/payments/link` - Code-to-Payment Association**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/link/route.ts`
- **Input Vectors:** JSON body `{ paymentId: string, code: string }`
- **Attack Surface:** UUID space (2^122) × code space (900k)
- **Validation:** Lines 14-30 validate formats and fetch existing records
- **Exploitation Potential:**
  - 🔴 **CRITICAL RACE CONDITION:** Lines 45-78 have TOCTOU vulnerability
  - **Payment Hijacking:** Multiple merchants can simultaneously link the same customer code
  - **Business Logic Bypass:** If state transitions aren't atomic, payment could transition awaiting_code → linked → awaiting_code

**5. GET `/api/payments/[id]/status` - Payment Status Query**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/[id]/status/route.ts`
- **Input Vector:** URL parameter `[id]` (UUID)
- **Attack Surface:** UUID enumeration space
- **Validation:** None—accepts any string as payment ID
- **Exploitation Potential:**
  - **Information Disclosure:** Reveals payment amounts, merchant wallets, customer wallets (if linked), and transaction status for any UUID
  - **Revenue Monitoring:** Competitor merchants can track each other's transaction volumes
  - **Lazy On-Chain Verification:** Lines 31-43 query blockchain to update status, causing performance DoS if spammed

**6. GET `/api/pay` - Solana Pay Metadata**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/pay/route.ts` (lines 13-18)
- **Input Vectors:** None
- **Attack Surface:** Minimal—returns static metadata `{ label: "SolanaBLIK", icon: "/icon.png" }`
- **Exploitation Potential:** Low risk (information disclosure only)

**7. POST `/api/pay` - Transaction Builder**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/pay/route.ts` (lines 28-107)
- **Input Vectors:** Query param `paymentId`, JSON body `{ account: string }`
- **Attack Surface:** Generates unsigned Solana transactions for any linked payment
- **Validation:** Lines 41-74 check payment status and validate account as public key
- **Exploitation Potential:**
  - **Transaction Template Theft:** Attacker who discovers linked payment ID can request transaction template (but cannot sign without private key)
  - **Amplification Attack:** Each request triggers PDA derivation and transaction building, consuming CPU
  - **Fingerprinting:** Transaction structure reveals payment amounts and merchant identities

**8. GET `/api/price` - Price Oracle Endpoint**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/price/route.ts`
- **Input Vectors:** None
- **Attack Surface:** Proxies CoinGecko API with 60s Next.js cache
- **Exploitation Potential:**
  - **Cache Poisoning:** If Next.js cache can be manipulated, stale prices could persist
  - **DoS on External API:** Excessive requests could trigger CoinGecko rate limits
  - **Price Manipulation:** Single-source price feed—if CoinGecko compromised, incorrect prices propagate

**Blockchain Layer - 1 On-Chain Instruction:**

**9. Solana Program Instruction: `pay`**
- **Program ID:** `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv`
- **Source:** `/Users/mac/kodziki/apps/solana-blik/programs/solanablik/src/lib.rs` (lines 18-61)
- **Input Vectors:** `amount: u64`, `payment_id: [u8; 16]`, plus 4 accounts (customer, merchant, receipt PDA, system program)
- **Attack Surface:** Callable by any Solana wallet with sufficient SOL for fees
- **Validation:** Lines 39-42 validate amount > 0 and account ownership
- **Exploitation Potential:**
  - **Replay Attacks:** MITIGATED—Receipt PDA uniqueness prevents re-execution of same payment ID
  - **Amount Overflow:** Rust u64 operations could overflow (Anchor uses checked math by default)
  - **Rent Exploitation:** Receipt PDA creation requires rent; attacker could spam PDAs to drain system (mitigated by tx fees)

**Web UI Layer - 2 Pages:**

**10. Customer Page: `/`**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/page.tsx`
- **Input Vectors:** User interactions (wallet connection, code generation button, payment approval)
- **Client-Side API Calls:** Lines 90, 113, 166, 228 (all to internal APIs)
- **Attack Surface:** XSS via user-controlled data rendering (analyzed in Section 9—none found)
- **Exploitation Potential:**
  - **Clickjacking:** No X-Frame-Options header allows embedding in attacker iframe
  - **Phishing:** UI could be cloned to trick users into connecting wallets and signing malicious transactions
  - **Transaction Manipulation:** Client-side code modifies transaction before signing (lines 233-241), but wallet displays final amounts for user confirmation

**11. Merchant Page: `/merchant`**
- **File:** `/Users/mac/kodziki/apps/solana-blik/src/app/merchant/page.tsx`
- **Input Vectors:** Amount input (numpad), code input (6 digits)
- **Client-Side API Calls:** Lines 60, 103, 181 (all to internal APIs)
- **Attack Surface:** Similar to customer page—clickjacking, phishing, input manipulation
- **Exploitation Potential:**
  - **Amount Tampering:** Client-side amount input (lines 67-84) could be manipulated before payment creation, but merchant sees amount before customer confirms
  - **Code Brute-Force UI:** Auto-advance on 6-digit entry (CodeInput component) could be automated to speed brute-forcing

### Internal Service Communication

**Finding:** The application does **NOT have internal service-to-service communication** in the traditional microservices sense. All components run in the same Next.js process (serverless functions on Vercel).

**Service Dependencies:**
- **Next.js API Routes ↔ Upstash Redis:** REST API over HTTPS (lines 44-47 in `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts`)
- **Next.js API Routes ↔ CoinGecko API:** HTTPS GET requests (line 20 in `/Users/mac/kodziki/apps/solana-blik/src/lib/price.ts`)
- **Client Browser ↔ Solana RPC:** WebSocket + HTTPS connections (line 6 in `/Users/mac/kodziki/apps/solana-blik/src/lib/solana.ts`)

**Trust Relationships:**
- **Trust Assumption 1:** Upstash Redis is trusted to store data integrity (no signature verification on retrieved values)
- **Trust Assumption 2:** CoinGecko API is trusted as single source of price truth (no multi-source validation)
- **Trust Assumption 3:** Solana RPC endpoint is trusted for blockchain state queries (no fraud proof verification)

**Attack Vectors via Service Communication:**
- **Redis Connection Hijacking:** If Upstash credentials leak (already occurred in `.env.local`), attacker can impersonate backend
- **CoinGecko MitM:** DNS poisoning or BGP hijack could redirect price queries to attacker-controlled endpoint
- **RPC Endpoint Substitution:** Client-side RPC endpoint is configurable via `NEXT_PUBLIC_RPC_ENDPOINT`—attacker could trick users into using malicious RPC

### Input Validation Patterns

**Validation Strategy:** The application uses **ad-hoc TypeScript type checks and regex validation**, with no centralized validation schema framework (e.g., Zod, Yup, Joi).

**Validation Inventory:**

**1. Solana Public Key Validation:**
```typescript
try {
  new PublicKey(walletPubkey);
} catch {
  return Response.json({ error: "Invalid Solana public key format." }, { status: 400 });
}
```
- **Locations:** `/api/codes/generate/route.ts:18`, `/api/payments/create/route.ts:31`, `/api/pay/route.ts:50`
- **Strength:** Uses Solana SDK validation (base58 format + length checks)
- **Weakness:** No additional allow/blocklisting of known malicious addresses

**2. 6-Digit Code Validation:**
```typescript
if (!code || !/^\d{6}$/.test(code)) {
  return Response.json({ error: "Invalid code format." }, { status: 400 });
}
```
- **Locations:** `/api/codes/[code]/resolve/route.ts:23`, `/api/payments/link/route.ts:22`
- **Strength:** Strict regex ensures exactly 6 decimal digits
- **Weakness:** No check for "impossible" codes (e.g., 000000 might never be generated)

**3. Amount Validation:**
```typescript
if (typeof amount !== "number" || amount <= 0) {
  return Response.json({ error: "Invalid amount. Must be a positive number." }, { status: 400 });
}
if (amount > 10_000) {
  return Response.json({ error: "Amount exceeds maximum allowed (10,000 SOL)." }, { status: 400 });
}
```
- **Location:** `/api/payments/create/route.ts:10-22`
- **Strength:** Enforces positive numbers and reasonable maximum
- **Weakness:** No minimum amount (could create 0.000000001 SOL payments), no precision limit (JavaScript floats could cause rounding errors when converting to lamports)

**4. Client-Side Input Sanitization (CodeInput Component):**
```typescript
const digit = value.replace(/\D/g, "").slice(-1);  // Remove non-digits
const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
```
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/components/CodeInput.tsx:41, 102`
- **Strength:** Prevents non-numeric input from reaching API
- **Note:** Client-side validation is bypassable—not a security control, just UX improvement

**Validation Gaps:**
- **No request body size limits:** Large JSON payloads could exhaust memory
- **No UUID format validation:** `/api/payments/[id]/status` accepts any string as payment ID
- **No content-type enforcement:** APIs don't validate `Content-Type: application/json` header
- **No timestamp validation:** `createdAt` fields are trusted from Redis without staleness checks

### Background Processing

**Finding:** The application uses **no traditional background job processors** (e.g., Bull, BullMQ, Celery). All processing is synchronous within API request handlers.

**Async Operations:**

**1. WebSocket Subscriptions (Client-Side):**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/page.tsx:204-220`
- **Purpose:** Monitor receipt PDA account creation for payment confirmation
- **Security:** Client subscribes to specific PDA address derived from payment ID—attacker cannot subscribe to other users' payments without knowing their payment IDs
- **Risk:** WebSocket disconnections could cause missed confirmations (mitigated by fallback HTTP polling)

**2. HTTP Polling (Client-Side Fallback):**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/page.tsx:224-251`
- **Purpose:** Poll `/api/payments/[id]/status` every 3 seconds if WebSocket fails
- **Security:** Polling is client-controlled and can be abused for DoS
- **Risk:** No server-side rate limiting allows unlimited polling

**3. Lazy On-Chain Verification (Server-Side):**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/[id]/status/route.ts:31-43`
- **Purpose:** Check if receipt PDA exists on blockchain to update payment status from "linked" to "paid"
- **Trigger:** On-demand when `/api/payments/[id]/status` is called
- **Security:** This is effectively "serverless background processing"—status updates happen lazily during user queries
- **Risk:** If no one queries status, a paid payment might remain marked as "linked" in Redis until TTL expires

**Privilege Models:**
Since there are no background jobs, there are no separate job execution contexts or privilege levels to analyze. All API handlers run with the same permissions (access to Redis via environment credentials).

**Exploitation Scenarios:**
- **DoS via Polling:** Attacker creates payment, then polls status endpoint at high frequency to trigger repeated blockchain RPC calls
- **Status Desynchronization:** Race condition between client-side WebSocket update and server-side lazy verification could cause UI inconsistencies

---

## 6. Infrastructure & Operational Security

### Secrets Management

**Implementation Analysis:** The application uses environment variables for secret storage, accessed via Node.js `process.env`. Secrets are defined in `.env.local` and referenced throughout the codebase without additional protection layers.

**Secret Inventory:**

**1. Upstash Redis Credentials (🔴 CRITICAL EXPOSURE)**
```bash
UPSTASH_REDIS_REST_URL=https://supreme-rattler-78549.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAATLVAAIncDE0ODM2YjUwMTFkYmM0M2EwOTgxNGNjZDc1YjE4MWYwZnAxNzg1NDk=
```
- **File:** `/Users/mac/kodziki/apps/solana-blik/.env.local` (lines 9-10)
- **Usage:** `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts:44-46`
- **Risk:** Production database credentials committed to repository
- **Impact:** Full read/write access to payment database; attacker can steal codes, modify payments, cause data loss
- **Rotation:** No rotation mechanism detected; credentials appear static

**2. Solana Network Configuration (⚠️ Public But Sensitive)**
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
```
- **File:** `/Users/mac/kodziki/apps/solana-blik/.env.local` (lines 2-3)
- **Usage:** `/Users/mac/kodziki/apps/solana-blik/src/lib/solana.ts:6-9`
- **Prefix:** `NEXT_PUBLIC_*` makes these variables embedded in client-side JavaScript bundle
- **Risk:** Public RPC endpoint subject to rate limits; attacker can see which RPC node application uses
- **Concern:** If mainnet deployed, custom RPC credentials would be exposed to all users

**3. Merchant Wallet (Placeholder)**
```bash
MERCHANT_WALLET=11111111111111111111111111111111
```
- **File:** `/Users/mac/kodziki/apps/solana-blik/.env.local` (line 6)
- **Analysis:** This is a placeholder/fallback value (Solana system program address)
- **Usage:** Not directly used in codebase—merchant wallets provided per-payment
- **Risk:** Low (placeholder value)

**Secrets Management Vulnerabilities:**
- ❌ **No secret encryption:** All secrets stored in plaintext
- ❌ **No secret rotation:** Static credentials with no automated rotation
- ❌ **No secret scanning:** No GitHub secret scanning or git-secrets pre-commit hooks detected
- ❌ **No secret manager integration:** No AWS Secrets Manager, HashiCorp Vault, or Vercel Encrypted Env Vars
- ⚠️ **Gitignore present but late:** `.gitignore` contains `.env*` (line 34), but `.env.local` already committed to history

**Recommended Mitigations:**
1. **Immediate:** Rotate Upstash Redis credentials via Upstash dashboard
2. **Immediate:** Remove `.env.local` from git history: `git filter-branch --index-filter 'git rm --cached --ignore-unmatch .env.local'`
3. **Short-term:** Use Vercel Environment Variables with encryption enabled
4. **Long-term:** Implement secret rotation policy (90-day rotation for database credentials)

### Configuration Security

**Environment Separation:** The application uses a single `.env.local` file for all environments, with no detected `.env.development`, `.env.production`, or `.env.test` files. This violates environment separation best practices.

**Current Configuration:**
- **Development:** Uses `.env.local` with devnet network and same Redis credentials
- **Production (Inferred):** Would use same `.env.local` if deployed to Vercel without overrides
- **Risk:** No separation between dev/prod secrets means development compromises affect production

**Secret Handling in Code:**

**Server-Side Secrets (✅ Correct Handling):**
```typescript
// Redis credentials accessed server-side only
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts:44-46`
- **Security:** These secrets are NOT exposed to client (no `NEXT_PUBLIC_` prefix)
- **Issue:** Non-null assertion operator `!` will cause runtime error if vars missing

**Client-Side "Secrets" (⚠️ Not Actually Secret):**
```typescript
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(SOLANA_NETWORK);
```
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/lib/solana.ts:9`
- **Exposure:** Embedded in client JavaScript bundle, visible in browser DevTools
- **Justification:** RPC endpoints are inherently public (users need them to connect)
- **Risk:** If custom RPC with auth token used, token would be exposed

**Security Header Configuration Analysis:**

**Finding:** ❌ **NO security headers configured** in infrastructure or application code.

**Checked Locations:**
- `/Users/mac/kodziki/apps/solana-blik/next.config.ts` - No `headers()` function defined
- No `middleware.ts` file exists to add response headers
- No Vercel `vercel.json` file for header configuration
- No Nginx/Apache configuration (serverless deployment)

**Missing Headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**Infrastructure-Level Headers:** Vercel provides automatic `Strict-Transport-Security` (HSTS) via its global CDN, but application-specific headers like CSP must be configured manually.

**Security Impact:**
- **Clickjacking:** No X-Frame-Options allows embedding site in malicious iframe
- **MIME Sniffing:** No X-Content-Type-Options allows browser to guess content types
- **XSS:** No Content-Security-Policy allows inline scripts (though React's JSX provides some protection)

### External Dependencies

**Third-Party Service Analysis:**

**1. CoinGecko API (Price Oracle)**
- **Endpoint:** `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur`
- **Usage:** `/Users/mac/kodziki/apps/solana-blik/src/lib/price.ts:20`
- **Authentication:** None (public API)
- **Rate Limiting:** CoinGecko free tier: 10-50 calls/minute (not enforced in app)
- **Caching:** Next.js cache with 60s revalidation
- **Failure Mode:** Falls back to hardcoded prices (USD: 140, PLN: 560, EUR: 130)
- **Security Risk:** Single point of failure for pricing; no multi-source validation; hardcoded fallback may be stale
- **Attack Scenario:** DNS hijacking redirects requests to attacker's fake API returning manipulated prices

**2. Upstash Redis (State Storage)**
- **Endpoint:** `https://supreme-rattler-78549.upstash.io`
- **Usage:** All payment and code storage
- **Authentication:** Bearer token in REST API
- **Encryption:** TLS 1.2+ for transit, AES-256 at rest (Upstash-provided)
- **Availability:** 99.99% SLA on paid tier (tier unknown for this app)
- **Security Risk:** Credentials exposed in `.env.local` (already discussed)

**3. Solana RPC Node (Blockchain Access)**
- **Endpoint:** `https://api.devnet.solana.com` (public devnet node)
- **Usage:** Transaction broadcasting, account queries, WebSocket subscriptions
- **Authentication:** None (public endpoint)
- **Rate Limiting:** Solana public nodes enforce rate limits (not published)
- **Reliability:** Public nodes have no SLA; may be slow or unavailable
- **Security Risk:** Public RPC nodes could return stale data, censor transactions, or log user activity
- **Attack Scenario:** Attacker convinces user to change `NEXT_PUBLIC_RPC_ENDPOINT` to malicious node that signs fake transactions

**NPM Dependency Security:**

**Critical Dependencies:**
- `@solana/web3.js@1.98.4` - Core Solana SDK (regularly audited by Solana Foundation)
- `@solana/wallet-adapter-react@0.15.39` - Wallet integration (community-maintained)
- `next@16.2.0` - Framework (Vercel-maintained, frequent security patches)
- `react@19.2.4` - UI library (Meta-maintained)

**Vulnerability Scanning:** No evidence of automated dependency scanning tools:
- ❌ No `dependabot.yml` for GitHub Dependabot
- ❌ No Snyk, Sonatype, or other vulnerability scanner integration
- ❌ No `npm audit` in CI/CD pipeline

**Transitive Dependency Risk:** `package.json` lists 29 direct dependencies but `node_modules` contains ~1000+ packages (transitive). Any vulnerability in transitive dependencies affects application security.

### Monitoring & Logging

**Logging Implementation:** The application uses **minimal logging** with no structured logging framework.

**Logging Locations:**
- **Console Logging (Development Only):** Various `console.log()` and `console.error()` statements exist in client-side code but are removed in production builds by Next.js
- **API Route Logging:** No explicit logging in API routes—errors bubble to Next.js default error handler
- **Blockchain Logging:** Solana transactions emit events (e.g., `PaymentCompleted` in line 58 of `/Users/mac/kodziki/apps/solana-blik/programs/solanablik/src/lib.rs`), but application doesn't listen to these events

**Security Event Visibility:**

**Logged Events:**
- ✅ Transaction confirmations (via client-side WebSocket subscriptions)
- ⚠️ API errors (via Next.js default handler, not structured)

**NOT Logged (Critical Gaps):**
- ❌ Failed authentication attempts (N/A - no authentication)
- ❌ Rate limit violations (N/A - no rate limiting)
- ❌ Invalid input attempts (validation errors returned to user, not logged)
- ❌ Suspicious patterns (e.g., rapid code generation from same IP)
- ❌ Payment status transitions (created → linked → paid)
- ❌ Code linkage attempts (successful and failed)
- ❌ Unusual amounts (e.g., max 10,000 SOL payments)

**Monitoring Infrastructure:**
- ❌ No APM (Application Performance Monitoring) like Datadog, New Relic
- ❌ No error tracking (Sentry, Rollbar, Bugsnag)
- ❌ No custom metrics or dashboards
- ⚠️ Vercel provides basic analytics (request counts, response times) but no security-specific metrics

**Recommended Monitoring:**
1. **Error Tracking:** Integrate Sentry for runtime error capture
2. **Security Logging:** Log all payment state transitions, code generations, and link attempts
3. **Alerting:** Set up alerts for:
   - High-frequency code generation (>10/minute from same IP)
   - Large payment amounts (>1000 SOL)
   - Failed code lookups (possible brute-force attempts)
4. **Audit Trail:** Store immutable logs of all API calls with timestamps, IPs, and parameters

---

## 7. Overall Codebase Indexing

The SolanaBLIK codebase follows a **modern monorepo structure** combining a Next.js 16 frontend/API application with a Solana Anchor smart contract program. The repository demonstrates clear separation between web application code (`/src`), blockchain program code (`/programs`), and configuration files at the root level. The project uses **TypeScript throughout** with strict typing enabled, providing compile-time safety that reduces certain classes of runtime errors.

**Directory Structure Analysis:**

The `/src` directory contains the entire Next.js application organized using the **App Router convention** (Next.js 13+), which differs from the legacy Pages Router. Security-relevant code is distributed across three primary subdirectories:

**1. `/src/app` - Route Handlers and Pages:** This directory uses Next.js file-based routing where folder names define URL paths. API routes live in `/src/app/api/*/route.ts` files (8 endpoints total), while page components live in `/src/app/page.tsx` (customer) and `/src/app/merchant/page.tsx`. The presence of a `layout.tsx` file defines the root application shell. This structure makes API endpoints easy to discover—any `/api/*/route.ts` file is automatically a network-accessible endpoint. However, the lack of middleware integration in this pattern means each route must independently implement security controls (none currently do).

**2. `/src/components` - Reusable UI Components:** React components are organized in a flat structure with clear naming: `WalletProvider.tsx` (authentication wrapper), `CodeInput.tsx` (6-digit input), `CodeDisplay.tsx` (countdown timer display), `AmountInput.tsx` (numpad), and `WalletButton.tsx` (wallet connection). These components handle client-side input sanitization and validation, serving as the first line of defense against malformed data. The code demonstrates good separation of concerns—input validation logic is encapsulated within components rather than scattered across pages.

**3. `/src/lib` - Business Logic and Utilities:** This directory contains the core security-critical logic: `codes.ts` (Redis/in-memory storage with TTL management), `program.ts` (Anchor transaction builder), `solana.ts` (RPC connection setup), and `price.ts` (CoinGecko integration). The `lib` directory also houses the `idl` subdirectory containing TypeScript types auto-generated from the Solana program's Interface Definition Language (IDL). This separation allows API routes to remain thin—they delegate business logic to `lib` modules.

**Blockchain Program Structure:**

The `/programs/solanablik` directory contains the Rust-based Anchor smart contract with standard Anchor project layout: `/programs/solanablik/src/lib.rs` (program logic), `/programs/solanablik/Cargo.toml` (Rust dependencies), and `/programs/solanablik/target` (build artifacts excluded from version control). Anchor framework conventions enforce strict account validation and serialization, reducing common Solana vulnerabilities like account confusion attacks. The program is intentionally minimal—only 93 lines of Rust—implementing a single `pay` instruction. This simplicity aids security review but limits functionality (no refunds, no escrow, no dispute resolution).

**Configuration and Build System:**

Root-level configuration files reveal security-relevant build settings:
- `next.config.ts`: Enables React Compiler (experimental) but lacks security header configuration
- `tsconfig.json`: Strict mode enabled, protecting against undefined/null bugs
- `package.json`: Defines 29 direct dependencies but no `scripts` for security scanning
- `tailwind.config.ts`: PostCSS configuration for styling (no security impact)
- `.gitignore`: Properly excludes `node_modules`, `.next`, `.env*`, but `.env.local` was already committed

**Build Orchestration:** No evidence of advanced build tooling like Dagger (mentioned in scope exclusions), Docker multi-stage builds, or CI/CD pipelines. Deployment likely uses Vercel's built-in Git integration (`vercel.json` is absent, so using defaults).

**Code Generation and Conventions:**

The codebase uses **Anchor's IDL code generation** to produce TypeScript types from the Solana program. The file `/src/lib/idl/solanablik.ts` (309 lines) is auto-generated from the Rust program's `target/idl/solanablik.json`. This ensures type safety between on-chain program and off-chain client but means changes to the smart contract require regenerating types. No other code generation tools detected (no GraphQL codegen, no Prisma ORM schema generation).

**Testing Infrastructure:**

**Critical Finding:** No test files discovered in standard locations (`*.test.ts`, `*.spec.ts`, `__tests__/`). The absence of unit tests, integration tests, and end-to-end tests means:
- Payment flow logic is unverified
- Race conditions (like code linking TOCTOU) likely went undetected
- Regression risk is high—changes could break security controls
- No fuzzing or property-based testing for smart contract

**Documentation:**

The repository contains no `docs/` directory, no `README.md` (or it's minimal), and no inline JSDoc comments explaining security-critical functions. The lack of documentation makes security review harder and increases onboarding risk for new developers who might introduce vulnerabilities.

**Discoverability Impact:**

For a penetration tester, this codebase structure is **highly discoverable**:
- API endpoints are trivial to enumerate (all in `/src/app/api/*/route.ts`)
- Business logic is centralized in `/src/lib` modules
- Smart contract logic is in a single 93-line Rust file
- No obfuscation, code splitting, or dynamic imports to hide structure

However, the lack of a centralized security configuration file (middleware.ts), scattered validation logic, and absence of tests make it difficult to assess whether security controls are consistently applied across all entry points.

---

## 8. Critical File Paths

All file paths listed below use absolute paths from the codebase root and are categorized by their security relevance for downstream analysis.

### Configuration
- `/Users/mac/kodziki/apps/solana-blik/next.config.ts` - Next.js configuration (missing security headers)
- `/Users/mac/kodziki/apps/solana-blik/tsconfig.json` - TypeScript strict mode configuration
- `/Users/mac/kodziki/apps/solana-blik/.env.local` - 🔴 CRITICAL: Contains exposed Upstash Redis credentials
- `/Users/mac/kodziki/apps/solana-blik/.gitignore` - Git exclusion rules (`.env*` present but `.env.local` already committed)
- `/Users/mac/kodziki/apps/solana-blik/tailwind.config.ts` - Tailwind CSS configuration
- `/Users/mac/kodziki/apps/solana-blik/postcss.config.mjs` - PostCSS processing configuration

### Authentication & Authorization
- `/Users/mac/kodziki/apps/solana-blik/src/components/WalletProvider.tsx` - Solana wallet adapter integration (autoConnect enabled)
- `/Users/mac/kodziki/apps/solana-blik/src/components/WalletButton.tsx` - Wallet connection UI
- `/Users/mac/kodziki/apps/solana-blik/src/lib/solana.ts` - RPC connection and network configuration

### API & Routing
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/generate/route.ts` - Code generation endpoint (unauthenticated)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/codes/[code]/resolve/route.ts` - Code status polling (brute-force vulnerable)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/create/route.ts` - Payment creation endpoint (unauthenticated)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/link/route.ts` - 🔴 CRITICAL: Code linking with race condition (lines 45-78)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/[id]/status/route.ts` - Payment status query (information disclosure)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/pay/route.ts` - Transaction builder (Solana Pay protocol)
- `/Users/mac/kodziki/apps/solana-blik/src/app/api/price/route.ts` - SOL price oracle endpoint
- `/Users/mac/kodziki/apps/solana-blik/src/app/page.tsx` - Customer payment interface
- `/Users/mac/kodziki/apps/solana-blik/src/app/merchant/page.tsx` - Merchant terminal interface
- `/Users/mac/kodziki/apps/solana-blik/src/app/layout.tsx` - Root application layout

### Data Models & DB Interaction
- `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts` - 🔴 CRITICAL: Redis storage with weak code generation (Math.random), lines 109-113
- `/Users/mac/kodziki/apps/solana-blik/src/lib/program.ts` - Anchor transaction builder and PDA derivation
- `/Users/mac/kodziki/apps/solana-blik/src/lib/payment.ts` - Re-exports from program.ts
- `/Users/mac/kodziki/apps/solana-blik/src/lib/idl/solanablik.ts` - Auto-generated Anchor IDL types

### Dependency Manifests
- `/Users/mac/kodziki/apps/solana-blik/package.json` - NPM dependencies (29 direct, ~1000 transitive)
- `/Users/mac/kodziki/apps/solana-blik/package-lock.json` - Locked dependency versions
- `/Users/mac/kodziki/apps/solana-blik/programs/solanablik/Cargo.toml` - Rust/Anchor dependencies

### Sensitive Data & Secrets Handling
- `/Users/mac/kodziki/apps/solana-blik/.env.local` - 🔴 DUPLICATE ENTRY: Exposed secrets (already listed in Configuration)
- `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts` - Payment and code storage with plaintext data
- `/Users/mac/kodziki/apps/solana-blik/src/lib/price.ts` - Price fetching with hardcoded fallback values

### Middleware & Input Validation
- `/Users/mac/kodziki/apps/solana-blik/src/components/CodeInput.tsx` - Client-side input sanitization (lines 41, 102)
- `/Users/mac/kodziki/apps/solana-blik/src/components/AmountInput.tsx` - Amount input validation (client-side)
- **NOTE:** No server-side middleware.ts file exists—all validation is per-route

### Logging & Monitoring
- **NOTE:** No dedicated logging configuration files found
- **NOTE:** No Sentry, Datadog, or monitoring integrations detected

### Infrastructure & Deployment
- **NOTE:** No Dockerfile, docker-compose.yml, or Kubernetes manifests found (serverless deployment)
- **NOTE:** No vercel.json configuration (using Vercel defaults)
- **NOTE:** No nginx.conf or Apache configuration (Vercel handles routing)
- `/Users/mac/kodziki/apps/solana-blik/programs/solanablik/src/lib.rs` - Solana smart contract (93 lines, single `pay` instruction)
- `/Users/mac/kodziki/apps/solana-blik/programs/solanablik/Anchor.toml` - Anchor build configuration
- **Program ID:** `AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv` (Devnet deployment)

---

## 9. XSS Sinks and Render Contexts

### Comprehensive XSS Sink Analysis

After exhaustive analysis of all network-accessible web components and API responses, **ZERO XSS vulnerabilities were identified** in the SolanaBLIK application. The application demonstrates strong XSS protection through exclusive use of React's JSX rendering system, which automatically escapes all dynamic content by default.

### Analysis Methodology

All React components, API routes, and client-side JavaScript files were systematically searched for dangerous sinks across seven vulnerability categories:

**Searched Patterns:**
1. **HTML Body Context:** `innerHTML`, `outerHTML`, `dangerouslySetInnerHTML`, `document.write`, `insertAdjacentHTML`, jQuery's `.html()/.append()`
2. **Attribute Context:** Dynamic `onclick/onerror/onload`, URL-based attributes (`href`, `src`, `formaction`), `style` attribute manipulation
3. **JavaScript Context:** `eval()`, `new Function()`, `setTimeout/setInterval` with strings
4. **CSS Context:** Dynamic style injection via `element.style` object
5. **URL Context:** `location.href` manipulation, `window.open()` with user input
6. **Template Injection:** Template engine usage (`.ejs`, `.pug`, `.hbs`), `compile()` functions
7. **Deserialization:** JSON parsing of untrusted data, `pickle/unserialize` patterns

### Key Findings - Why No XSS Exists

**1. React JSX Auto-Escaping (Primary Protection)**

All user-generated content is rendered through React components, which escape HTML entities by default. Examples:

```typescript
// Customer wallet address display - safe
<p className="text-sm text-gray-500">
  {wallet.publicKey?.toBase58()}  {/* Escaped as text */}
</p>

// Payment code display - safe
<div className="text-5xl font-mono">
  {code}  {/* Rendered as text, not HTML */}
</div>

// Amount display - safe
<div className="text-3xl font-bold">
  {amount} SOL  {/* Number coerced to string, then escaped */}
</div>
```

**Location:** Throughout `/Users/mac/kodziki/apps/solana-blik/src/app/page.tsx` and `/src/app/merchant/page.tsx`

**2. No `dangerouslySetInnerHTML` Usage**

Searched all `.tsx` and `.jsx` files for `dangerouslySetInnerHTML` prop—**zero occurrences found**. This React API bypasses auto-escaping and is the most common XSS vector in React apps.

**3. API Responses Use JSON (Not HTML)**

All API routes return `Response.json()` with `Content-Type: application/json` headers. Example:

```typescript
return Response.json({
  code: "123456",
  expiresIn: 120
});
```

**Location:** All 8 API routes in `/Users/mac/kodziki/apps/solana-blik/src/app/api/**/*.ts`

JSON responses cannot execute JavaScript in browser contexts. Even if an attacker injects `<script>alert(1)</script>` into a code field, the browser treats it as JSON data, not HTML.

**4. Client-Side Input Sanitization**

User input is sanitized before rendering using regex replacement:

```typescript
// Remove all non-digit characters
const digit = value.replace(/\D/g, "").slice(-1);
const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
```

**Location:** `/Users/mac/kodziki/apps/solana-blik/src/components/CodeInput.tsx:41, 102`

While this is defense-in-depth (React would escape anyway), it prevents non-alphanumeric characters from even reaching the rendering layer.

**5. No Template Engines**

Searched for server-side template engines (EJS, Pug, Handlebars, Mustache)—**none found**. The application uses React for 100% of HTML generation, eliminating template injection risks.

**6. No Dynamic Script Generation**

Searched for `eval()`, `new Function()`, `setTimeout(string)`, `setInterval(string)` with user-controllable strings—**none found**. All JavaScript execution uses static functions or pre-defined callbacks.

**7. URL Handling Uses React Router**

Navigation uses Next.js `<Link>` components or controlled `window.location` assignments with validation:

```typescript
// Safe navigation - no user input in URL
<Link href="/merchant">Merchant Terminal</Link>
```

No instances of `location.href = userInput` or `window.open(userInput)` exist.

### Potential Indirect XSS Vectors (Mitigated)

**1. Wallet Address Injection**
- **Risk:** Attacker provides malicious wallet address like `<script>alert(1)</script>`
- **Mitigation:** Solana `PublicKey` constructor validates base58 format and throws error for invalid addresses (lines 18-25 in `/api/codes/generate/route.ts`)
- **Result:** Invalid addresses rejected before storage; valid addresses are alphanumeric only (base58 charset: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`)

**2. Payment Amount Manipulation**
- **Risk:** Attacker injects HTML in amount field like `<img src=x onerror=alert(1)>`
- **Mitigation:** TypeScript enforces `amount: number` type; JavaScript coerces strings to numbers or NaN (lines 10-22 in `/api/payments/create/route.ts`)
- **Result:** Non-numeric input becomes `NaN` and is rejected; numbers render as text

**3. UUID Enumeration**
- **Risk:** Payment IDs displayed in UI could contain injected scripts if UUID generation is compromised
- **Mitigation:** UUIDs generated using `uuid` library v13.0.0, which produces RFC4122-compliant format (hex digits and hyphens only: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- **Result:** No script execution possible with hex charset

### Content Security Policy (CSP) Gap

**Critical Observation:** While no XSS sinks exist in the application code, **no Content Security Policy header** is configured to provide defense-in-depth.

**Missing CSP:** No CSP header in Next.js config (`next.config.ts`) or middleware. Recommended policy:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';  /* React requires inline scripts */
  style-src 'self' 'unsafe-inline';  /* Tailwind requires inline styles */
  connect-src 'self' https://api.devnet.solana.com https://api.coingecko.com;
  img-src 'self' data:;
  font-src 'self';
  frame-ancestors 'none';
```

**Risk Without CSP:** If a future code change introduces XSS, there's no secondary defense layer.

### Conclusion

The SolanaBLIK application is **XSS-free** due to consistent use of React's auto-escaping JSX rendering and absence of dangerous APIs like `dangerouslySetInnerHTML`, `eval()`, or template engines. All user input flows through type-validated APIs and is rendered as text, not executable HTML. However, the lack of CSP means the application relies on a single layer of defense (React's escaping) rather than defense-in-depth. **Recommendation:** Add CSP headers for future-proofing.

---

## 10. SSRF Sinks

### Comprehensive SSRF Analysis

After thorough examination of all server-side code paths and HTTP client usage, **ZERO exploitable SSRF vulnerabilities** were identified in the SolanaBLIK application's network-accessible components. The application makes minimal outbound HTTP requests, all of which use hardcoded URLs or environment-configured endpoints with no user input influence.

### Analysis Methodology

All server-side files (API routes in `/src/app/api/*` and library files in `/src/lib/*`) were searched for patterns indicating server-side requests:

**Searched SSRF Sink Categories:**
1. HTTP(S) clients: `fetch()`, `axios`, `request`, `http.get`, `urllib`
2. Raw sockets: `net.Socket`, `socket.connect`, `net.Dial`
3. URL openers: `file_get_contents`, `fopen`, `include`, `import()`
4. Redirect handlers: `response.redirect`, `Location` header with user input
5. Headless browsers: Puppeteer, Playwright, Selenium
6. Media processors: ImageMagick, FFmpeg, wkhtmltopdf
7. Link preview generators: oEmbed, OpenGraph fetchers
8. Webhook handlers: User-configurable webhook URLs
9. SSO/OIDC discovery: JWKS fetchers, `.well-known` endpoints
10. Package/plugin installers: "Install from URL" features

### Key Findings - External Requests Inventory

**1. CoinGecko API Price Fetch (✅ NOT VULNERABLE)**

**Location:** `/Users/mac/kodziki/apps/solana-blik/src/lib/price.ts:20`

**Code:**
```typescript
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur";

const res = await fetch(COINGECKO_URL, { next: { revalidate: 60 } });
```

**Assessment:**
- **URL Source:** Hardcoded constant (line 5)
- **User Input:** None - no parameters derived from user requests
- **Query String:** Static currencies (`usd,pln,eur`)
- **SSRF Risk:** NONE - attacker cannot modify target URL
- **Defense:** URL is compile-time constant

**2. Solana RPC Connection (✅ NOT VULNERABLE)**

**Location:** `/Users/mac/kodziki/apps/solana-blik/src/lib/solana.ts:6-9`

**Code:**
```typescript
export const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "devnet" | "mainnet-beta";
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(SOLANA_NETWORK);
export const connection = new Connection(RPC_ENDPOINT, "confirmed");
```

**Assessment:**
- **URL Source:** Environment variable (`NEXT_PUBLIC_RPC_ENDPOINT`) or Solana SDK helper function
- **User Input:** None - RPC endpoint set at build time, not runtime
- **Client-Side Usage:** Yes (client components use same connection)
- **Server-Side Usage:** Yes (API routes use for lazy verification)
- **SSRF Risk:** NONE - attacker cannot modify RPC URL through API requests
- **Note:** While `NEXT_PUBLIC_*` variables are client-visible, they're static after build

**Blockchain RPC Calls (Server-Side):**
- **Location:** `/Users/mac/kodziki/apps/solana-blik/src/app/api/payments/[id]/status/route.ts:31-43`
- **Code:** `connection.getAccountInfo(new PublicKey(payment.reference))`
- **Assessment:** Queries specific Solana account addresses (PDA receipts), but addresses are derived from payment UUIDs, not directly user-provided
- **SSRF Risk:** NONE - RPC endpoint is fixed; only account addresses vary (which is expected behavior)

**3. Upstash Redis REST API (✅ NOT VULNERABLE)**

**Location:** `/Users/mac/kodziki/apps/solana-blik/src/lib/codes.ts:44-46`

**Code:**
```typescript
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

**Assessment:**
- **URL Source:** Environment variable (server-side only, no `NEXT_PUBLIC_` prefix)
- **User Input:** Redis keys (e.g., `code:123456`) use user-provided codes, but Upstash SDK encodes them safely
- **HTTP Method:** SDK uses POST requests to Upstash REST API with base64-encoded commands
- **SSRF Risk:** NONE - Upstash URL is environment-configured, not user-controllable
- **Defense:** SDK prevents URL injection in Redis keys

**4. No File Includes/Imports with User Input**

**Searched Patterns:**
- `require(userInput)`, `import(userInput)`, `fs.readFile(userInput)`, `fopen(userInput)`
- **Result:** All `import` statements use static paths; no dynamic imports with user variables

**5. No Webhook or Redirect Handlers**

**Searched Patterns:**
- User-configured webhook URLs (e.g., `POST /api/webhooks { url: "..." }`)
- OAuth callback redirects with user-provided `redirect_uri`
- "Fetch from URL" or "Load external content" features
- **Result:** NONE found

**6. No Media Processing or URL-Based Operations**

**Searched Patterns:**
- Image processing libraries (ImageMagick, Sharp, FFmpeg)
- PDF generators (wkhtmltopdf, Puppeteer PDF export)
- Link preview generators (unfurl, metadata extractors)
- **Result:** NONE found - application is pure data/transaction processing

**7. No SSO/OIDC Discovery**

**Searched Patterns:**
- JWKS URL fetching (e.g., `fetch(issuer + '/.well-known/jwks.json')`)
- OpenID discovery endpoints
- SAML metadata fetchers
- **Result:** NONE found - application uses wallet-based auth, not SSO

### No SSRF Vulnerabilities Found

**Conclusion:** The application's server-side code makes **exactly 3 categories of outbound requests**, all using fixed endpoints:
1. CoinGecko API (hardcoded URL)
2. Solana RPC node (environment-configured, static after build)
3. Upstash Redis (environment-configured, server-side only)

**None of these requests accept user-controllable URLs, hostnames, or ports.** All API route handlers process user input purely for business logic (wallet addresses, payment amounts, codes) without incorporating that input into outbound request targets.

### Client-Side SSRF Considerations (Out of Scope)

**Client-Side Fetch Calls:** The customer and merchant pages make fetch calls to internal APIs:

```typescript
// Example from /src/app/page.tsx:90
const response = await fetch("/api/codes/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ walletPubkey: wallet.publicKey?.toBase58() }),
});
```

**SSRF Applicability:** These are **client-initiated requests** where the browser (not server) acts as the HTTP client. This is **not SSRF** because:
- Requests originate from end-user's browser, not application server
- Browser's same-origin policy prevents targeting internal networks
- Even if URL is attacker-controlled, browser enforces CORS

**Out-of-Scope Justification:** Per assessment scope, we focus on server-side requests where the application server can be tricked into fetching resources on behalf of the attacker, potentially accessing internal services, cloud metadata endpoints, or performing port scans. Client-side fetch calls do not meet this threat model.

### Recommended Safeguards (Defense-in-Depth)

While no SSRF vulnerabilities exist, these hardening measures would provide additional assurance:

**1. URL Allowlisting for External Services:**
```typescript
// Hardened CoinGecko fetch
const ALLOWED_HOSTS = ['api.coingecko.com'];
const url = new URL(COINGECKO_URL);
if (!ALLOWED_HOSTS.includes(url.hostname)) {
  throw new Error('Unauthorized external host');
}
```

**2. RPC Endpoint Validation:**
```typescript
// Validate RPC endpoint format on startup
const rpcUrl = new URL(RPC_ENDPOINT);
if (!rpcUrl.protocol.startsWith('http')) {
  throw new Error('Invalid RPC protocol');
}
```

**3. Network Segmentation (Infrastructure Layer):**
- Configure Vercel functions to disallow outbound requests to private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254/32)
- Block access to cloud metadata endpoints (169.254.169.254 for AWS/GCP)

**4. Request Timeout Enforcement:**
```typescript
// Add timeout to CoinGecko fetch
const res = await fetch(COINGECKO_URL, {
  signal: AbortSignal.timeout(5000)  // 5 second timeout
});
```

### Conclusion

The SolanaBLIK application is **SSRF-free** due to minimal external service dependencies and strict use of environment-configured or hardcoded URLs. All three outbound request categories (price API, blockchain RPC, Redis) lack user-controllable target parameters. The application's design as a thin orchestration layer between client-side wallets and blockchain smart contracts naturally limits SSRF attack surface. **Recommendation:** Maintain this secure pattern—avoid adding features that accept user-provided URLs (e.g., webhook notifications, profile image imports, link previews).

---

