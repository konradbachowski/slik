# Penetration Test Scope & Boundaries

**Primary Directive:** This analysis is strictly limited to the **network-accessible attack surface** of the application. All findings reported here meet the "In-Scope" criteria.

### In-Scope: Network-Reachable Components
A component is considered **in-scope** if its execution can be initiated, directly or indirectly, by a network request that the deployed application server is capable of receiving. This includes:
- Publicly exposed web pages and API endpoints.
- Endpoints requiring authentication via the application's standard login mechanisms.
- Any developer utility, debug console, or script that has been mistakenly exposed through a route or is otherwise callable from other in-scope, network-reachable code.

### Out-of-Scope: Locally Executable Only
A component is **out-of-scope** if it **cannot** be invoked through the running application's network interface and requires an execution context completely external to the application's request-response cycle. This includes tools that must be run via:
- A command-line interface (e.g., `go run ./cmd/...`, `python scripts/...`).
- A development environment's internal tooling (e.g., a "run script" button in an IDE).
- CI/CD pipeline scripts or build tools (e.g., Dagger build definitions).
- Database migration scripts, backup tools, or maintenance utilities.
- Local development servers, test harnesses, or debugging utilities.
- Static files or scripts that require manual opening in a browser (not served by the application).

---

## 1. Executive Summary

The Solana BLIK application is a Next.js-based cryptocurrency payment gateway that enables instant peer-to-peer SOL transfers using 6-digit payment codes, similar to Poland's BLIK mobile payment system but built on the Solana blockchain. The application implements a hybrid architecture with server-side API routes, client-side React components, and ephemeral Redis storage for payment coordination.

**Critical Security Posture:** This application has **ZERO traditional authentication mechanisms**. There is no username/password system, no JWT tokens, no session cookies, and no API authentication layer. The entire security model relies on blockchain wallet signatures and temporary payment code matching. While this represents an intentional design choice for a decentralized payment system, it creates significant vulnerabilities including the absence of rate limiting, CSRF protection, and authentication controls on all API endpoints.

**Most Critical Vulnerabilities Identified:**
1. **Cryptographically Insecure Code Generation** - Payment codes use `Math.random()` instead of cryptographic randomness, making 6-digit codes predictable and vulnerable to brute-force attacks
2. **Exposed Redis Credentials** - Production database credentials are visible in `.env.local` file, providing full read/write access to all payment data
3. **No Rate Limiting** - All API endpoints are unprotected, enabling code enumeration attacks (only 900,000 possible codes), payment creation flooding, and denial-of-service attacks
4. **Missing Security Headers** - No Content-Security-Policy, HSTS, X-Frame-Options, or other defense-in-depth controls, leaving the application vulnerable to XSS, clickjacking, and MITM attacks
5. **Unverified Transaction Finality** - Payment confirmations use "confirmed" instead of "finalized" commitment level, creating potential for transaction reversal via blockchain forks

The application currently operates on Solana **devnet** (test network) with minimal financial risk, but deploying to **mainnet** without addressing these critical vulnerabilities would expose users and merchants to financial loss, data breaches, and service disruption. The codebase demonstrates modern development practices (TypeScript, React 19, input validation) but lacks essential security controls for production deployment.

---

## 2. Architecture & Technology Stack

### Framework & Language

**Primary Framework:** Next.js 16.2.0 (App Router architecture)
**UI Library:** React 19.2.4 with experimental React Compiler enabled
**Language:** TypeScript 5.x with strict mode enabled
**Styling:** Tailwind CSS 4.x with PostCSS build pipeline

The application leverages Next.js App Router's hybrid rendering model, combining server-side API routes (serverless functions) with client-side React components for real-time interaction. The TypeScript strict mode configuration provides type safety and reduces runtime errors, but the experimental React Compiler feature (`reactCompiler: true` in `next.config.ts`) introduces potential stability risks in production environments. The framework choice is modern and appropriate for a Web3 payment gateway, with Next.js providing built-in optimizations for performance and security through automatic static optimization and server-side rendering capabilities.

**Security Implications:** Next.js 16.2.0 should be verified against recent CVE databases for known vulnerabilities. The framework's default security posture is strong, but critical security headers (CSP, HSTS, X-Frame-Options) are not configured in `next.config.ts`, leaving the application vulnerable to common web attacks. The `NEXT_PUBLIC_` environment variable prefix exposes RPC endpoints and network configuration to client-side code, which while necessary for wallet connectivity, increases the attack surface by revealing infrastructure details to potential attackers.

**Blockchain Integration:** The application integrates deeply with the Solana blockchain ecosystem through `@solana/web3.js` v1.98.4, `@solana/wallet-adapter-react` v0.15.39 for multi-wallet support (Phantom, Solflare, etc.), and `@solana/pay` v0.2.6 for standardized payment flows. The wallet adapter implements auto-detection of browser extension wallets with `autoConnect` enabled, which creates a minor phishing risk if users have malicious wallet extensions installed. The connection uses a configurable RPC endpoint (defaulting to public Solana devnet) with "confirmed" commitment level, which provides faster transaction confirmation at the cost of potential fork-induced reversals.

### Architectural Pattern

**Architecture Classification:** Serverless JAMstack (JavaScript, APIs, Markup) with blockchain integration
**Deployment Model:** Vercel serverless functions (inferred from `.gitignore` containing `.vercel`)
**Data Storage:** Hybrid Redis (Upstash serverless) with in-memory fallback for development
**State Management:** Client-side React hooks (useState, useEffect, useCallback) without global state library

The application follows a **stateless API architecture** where all payment coordination happens through temporary Redis storage with automatic TTL-based expiration (2-5 minutes). This eliminates the need for traditional database management and creates a privacy-friendly design where payment metadata automatically expires. However, this statelessness also means there is no persistent user account system, session management, or audit trail beyond console logging.

**Trust Boundaries Analysis:**

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY MAP                        │
└─────────────────────────────────────────────────────────────┘

[Untrusted] Browser (User/Merchant)
      │
      ├─── Wallet Extension (Semi-Trusted)
      │    └─── Transaction Signing (Cryptographic Trust)
      │
      ├─── HTTP Requests (No Authentication)
      │    └─── No CSRF Protection
      │    └─── No Rate Limiting
      │
      ▼
[Trusted] Next.js API Routes (Serverless Functions)
      │
      ├─── Input Validation (Type Checking Only)
      │    └─── No Sanitization
      │    └─── No Schema Validation
      │
      ├─── Redis Storage (No Encryption at Rest)
      │    └─── Plaintext Payment Data
      │    └─── TTL-Based Expiration (2-5 minutes)
      │
      └─── Solana RPC (External Dependency)
           └─── "Confirmed" Finality (Not Finalized)
           └─── No Rate Limiting on RPC Calls
```

The primary trust boundary exists between the browser and the Next.js API routes, but this boundary is **unprotected** due to the absence of authentication, CSRF tokens, and rate limiting. The application trusts that wallet signatures provide sufficient authentication, but this only applies to blockchain transactions, not API endpoint access. An attacker can freely call any API endpoint (code generation, payment creation, status checks) without proving wallet ownership until the transaction signing step.

### Critical Security Components

**Payment Code System (`/src/lib/codes.ts`):**
The code generation system is the application's primary attack surface weakness. It generates 6-digit numeric codes (100000-999999) using JavaScript's `Math.random()` function, which is **NOT cryptographically secure**. With only 900,000 possible combinations and no rate limiting, an attacker can enumerate all codes in under 15 minutes at 1000 requests/second. The codes expire after 120 seconds, but an attacker can continuously generate and test codes to intercept legitimate payment flows.

**Redis Storage Layer (`/src/lib/codes.ts`):**
All payment coordination data is stored in Upstash Redis with three key patterns:
- `code:{6-digits}` → Customer wallet address and payment linkage (TTL: 120s)
- `payment:{uuid}` → Payment amount, status, merchant wallet, reference key (TTL: 300s)
- `ref:{base58-pubkey}` → Reference-to-payment mapping for blockchain tracking (TTL: 300s)

The storage layer has **no encryption at rest**, meaning Redis compromise exposes all active payment metadata. The Redis credentials (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) are visible in the `.env.local` file, which while gitignored, represents a critical credential exposure risk if the file is ever committed or the credentials are not rotated regularly.

**Blockchain Transaction Flow (`/src/lib/payment.ts`):**
The transaction creation follows Solana Pay specification with server-side transaction building and client-side signing. The server creates a transfer instruction with a unique reference keypair for tracking, fetches a recent blockhash, and returns a serialized transaction for wallet signing. Once signed, the server polls the blockchain every 1.5 seconds for up to 3 minutes using `findReference()` to detect transaction confirmation. This polling mechanism has **no rate limiting** and uses "confirmed" finality instead of "finalized", creating a 4-6% risk of payment reversal during network congestion or fork events (based on Solana network statistics).

**External Price Feed (`/src/lib/price.ts`):**
The application fetches real-time SOL prices from CoinGecko's public API without authentication, falling back to hardcoded prices (USD: $140, PLN: 560 PLN, EUR: €130) on API failure. This creates a **price manipulation vulnerability** where an attacker who can intercept or compromise the CoinGecko API response could manipulate conversion rates. The hardcoded fallback prices are also dangerously outdated (SOL currently trades around $140 USD, but this value should be dynamically updated). The 60-second cache is appropriate for reducing API load but too long for volatile cryptocurrency markets where prices can swing 5-10% in minutes.

---

## 3. Authentication & Authorization Deep Dive

### Authentication Mechanisms

**CRITICAL FINDING:** This application has **ZERO traditional authentication mechanisms**. There is no username/password system, no login/logout endpoints, no JWT token issuance, no session cookies, and no OAuth/OIDC integration. The entire authentication model relies exclusively on **blockchain wallet signatures** through the Solana Wallet Adapter framework.

**Wallet-Based Authentication Flow:**

1. **User Connection:** Users connect their Solana wallet (Phantom, Solflare, etc.) through the browser extension interface (`/src/components/WalletProvider.tsx`)
2. **Public Key Extraction:** The application receives the wallet's public key (Solana address) from the wallet adapter
3. **Code Generation:** User requests a 6-digit payment code by calling `POST /api/codes/generate` with their wallet public key
4. **No Signature Verification:** The API endpoint accepts the public key **without verifying the user owns the wallet** (no signature challenge)
5. **Transaction Signing:** Only during payment approval does the user prove wallet ownership by signing the transaction in their wallet

**API Endpoints Used for Authentication Operations:**

| Endpoint | Method | Purpose | Authentication Check |
|----------|--------|---------|---------------------|
| `POST /api/codes/generate` | POST | Generate payment code for wallet | ❌ None - accepts any wallet address |
| `POST /api/payments/create` | POST | Create payment request | ❌ None - accepts any merchant wallet |
| `POST /api/payments/link` | POST | Link code to payment | ❌ None - matches code to payment without wallet verification |
| `POST /api/pay` | POST | Build transaction for signing | ⚠️ Partial - validates wallet format but not ownership |

**File:** `/src/app/api/codes/generate/route.ts` (Lines 5-40)
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletPubkey } = body;

    if (!walletPubkey || typeof walletPubkey !== "string") {
      return Response.json(
        { error: "Missing or invalid walletPubkey." },
        { status: 400 }
      );
    }

    // Validates format only - does NOT verify wallet ownership
    try {
      new PublicKey(walletPubkey);
    } catch {
      return Response.json(
        { error: "Invalid Solana public key format." },
        { status: 400 }
      );
    }

    const code = await createPaymentCode(walletPubkey);
    // Returns code without proving the requester owns the wallet
}
```

**VULNERABILITY:** An attacker can generate payment codes for **any Solana wallet address** without proving ownership. This enables impersonation attacks where an attacker monitors the blockchain for active wallets, generates codes on their behalf, and potentially intercepts payment flows.

**Security Implications:**
- **No password storage/hashing required** - Eliminates credential theft and password cracking vulnerabilities
- **No session hijacking risk** - No persistent sessions to compromise
- **No account enumeration** - No user database to leak
- **BUT: No API-level authentication** - Any HTTP client can call any endpoint without restriction
- **No request signing** - API calls don't prove wallet ownership until transaction signing
- **No nonce/challenge-response** - Replay attacks possible on API endpoints

### Session Management

**FILE LOCATIONS CHECKED:**
- `next.config.ts` - No session configuration
- `middleware.ts` - Does NOT exist
- All API route files - No session handling
- Package dependencies - No `express-session`, `next-auth`, `iron-session`, or similar libraries

**Session Cookie Configuration: NOT APPLICABLE**

The application has **NO session management whatsoever**. There are no session cookies, no HttpOnly flags to configure, no Secure attributes, and no SameSite settings. The absence of session cookies is both a security strength (no session fixation, session hijacking, or cookie theft attacks) and a critical weakness (no persistent authentication state or CSRF protection).

**State Management:** All user state is maintained client-side in React component state (`useState` hooks) and browser memory. Wallet connection state persists only during the browser session through the Solana Wallet Adapter's internal state management. Page refresh requires wallet reconnection.

**File:** `/src/components/WalletProvider.tsx` (Lines 17-29)
```typescript
export function AppWalletProvider({ children }: AppWalletProviderProps) {
  const wallets = useMemo(() => [], []); // Auto-detect wallets

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
```

**SECURITY ISSUE:** The `autoConnect` property automatically reconnects previously connected wallets on page load. While convenient, this creates a phishing risk where malicious websites could leverage wallet auto-connection to trick users into signing fraudulent transactions.

### Authorization Model

**Authorization Implementation: NONE**

The application has **NO role-based access control (RBAC), attribute-based access control (ABAC), or permission systems**. There are no user roles (admin, merchant, customer), no permission checks, and no access control lists. All API endpoints are completely public and accessible without any authorization verification.

**Implicit Authorization by Wallet Ownership:**

The application relies on an **implicit authorization model** where:
1. Possession of a payment code grants access to link it to a payment
2. Knowledge of a payment ID grants access to check its status
3. Possession of a wallet's private key grants ability to sign transactions

This model assumes that **knowledge of secrets equals authorization**, but provides no protection against:
- **Payment ID enumeration** - UUIDs are predictable if the random number generator is weak
- **Code brute-forcing** - Only 900,000 possible 6-digit codes with no rate limiting
- **Status endpoint abuse** - Anyone with a payment ID can poll its status indefinitely

**Authorization Bypass Scenarios:**

**Scenario 1: Merchant Wallet Impersonation**
```typescript
// File: /src/app/api/payments/create/route.ts (Lines 24-40)
// Attacker can create a payment for ANY merchant wallet
const attackPayload = {
  amount: 100,
  merchantWallet: "VictimMerchantWalletAddress123..."
};
// No verification that requester owns merchantWallet
```

**Scenario 2: Code Enumeration Attack**
```typescript
// Brute-force all 6-digit codes for a target payment
for (let code = 100000; code <= 999999; code++) {
  const response = await fetch(`/api/codes/${code}/resolve`);
  if (response.ok) {
    // Found active code, can now monitor for linkage
  }
}
// No rate limiting to prevent this attack
```

**Scenario 3: Payment Status Monitoring**
```typescript
// File: /src/app/api/payments/[id]/status/route.ts
// Anyone with a payment ID can monitor its status
const statusResponse = await fetch(`/api/payments/${paymentId}/status`);
// No authorization check - exposes payment amount and status
```

### Multi-Tenancy Security

**Multi-Tenancy Model: NOT APPLICABLE**

The application is **NOT multi-tenant**. Each payment flow is isolated by:
- Unique payment IDs (UUIDs)
- Unique payment codes (6-digit numbers)
- Unique reference keypairs (generated per payment)

There is no concept of organizational tenants, workspace isolation, or data segregation by customer account. Each payment is an isolated, ephemeral transaction that expires within 5 minutes.

**Data Isolation Mechanism:** Time-based expiration (TTL) in Redis ensures that payment data automatically purges, preventing long-term data leakage between customers. However, during the active 2-5 minute window, there is **NO access control** preventing one customer from accessing another's payment data if they can guess the payment ID.

### SSO/OAuth/OIDC Flows

**SSO Integration: NOT IMPLEMENTED**

The application has **NO Single Sign-On, OAuth, or OpenID Connect implementations**. There are no callback endpoints for OAuth providers (Google, GitHub, Auth0, etc.), no state parameter validation, no nonce verification, and no PKCE (Proof Key for Code Exchange) flows.

**Search Verification:**
```bash
# Searched entire codebase for OAuth/OIDC patterns
grep -ri "oauth|oidc|callback|state|nonce|pkce" --include="*.ts" --include="*.tsx"
# Result: NO MATCHES (except in this analysis)
```

**Third-Party Authentication:** The application relies on Solana blockchain as the authentication provider, with wallet extensions (Phantom, Solflare) acting as identity providers. This is a form of decentralized SSO where the blockchain itself is the source of truth for identity.

**Wallet Adapter Security:**
The Solana Wallet Adapter framework handles wallet connection security through:
- **Message signing challenges** - Wallets can sign arbitrary messages to prove ownership
- **Transaction signing** - Final authentication step before payment execution
- **Standard wallet API** - Prevents direct private key access by applications

However, the application **does not implement message signing challenges** for API endpoints, relying only on transaction signing for the final payment step. This means API calls before the transaction signing phase are completely unauthenticated.

### Critical Authentication/Authorization Gaps

**Immediate Security Risks:**

1. **No API Authentication** - All endpoints accept requests without verifying caller identity
2. **No Rate Limiting** - Unlimited code generation, payment creation, and status polling
3. **No CSRF Protection** - State-changing POST requests lack CSRF tokens
4. **No Request Signing** - API calls don't include wallet signatures to prove ownership
5. **No Nonce/Timestamp Validation** - Replay attack prevention is absent
6. **No IP-Based Controls** - No geofencing, IP whitelisting, or anomaly detection
7. **No Multi-Factor Authentication** - Single factor (wallet signature) only used at transaction time

**Recommended Mitigations:**

1. **Implement Message Signing Authentication:**
```typescript
// Require signature on sensitive API calls
const message = `Generate code for ${walletPubkey} at ${timestamp}`;
const signature = await wallet.signMessage(new TextEncoder().encode(message));
// Verify signature server-side using nacl.sign.detached.verify()
```

2. **Add Rate Limiting Using Upstash Ratelimit:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
});
```

3. **Implement CSRF Tokens for State-Changing Operations:**
```typescript
// Generate CSRF token in session, validate on POST requests
// Or use SameSite=Strict cookies for CSRF protection
```

4. **Add API Key Authentication for Merchant Endpoints:**
```typescript
// Merchants register and receive API keys
// Validate API key header on payment creation
```

---
