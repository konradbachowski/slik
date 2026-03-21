# Injection Analysis Report (SQLi & Command Injection)

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** One low-severity NoSQL injection vulnerability was identified in the Redis key construction for the payment status endpoint. No SQL injection or command injection vulnerabilities exist in this application. All other injection vectors (Path Traversal, LFI/RFI, SSTI, Prototype Pollution, SSRF) were analyzed and confirmed secure.
- **Purpose of this Document:** This report provides the strategic context, dominant patterns, and environmental intelligence necessary to understand the application's injection attack surface. It documents both vulnerabilities found and vectors confirmed secure.

**Architecture Note:** This application uses Redis (key-value store) rather than a relational database, and has no shell command execution in network-accessible code. Therefore, traditional SQL injection and command injection attack surfaces do not exist.

---

## 2. Dominant Vulnerability Patterns

### Pattern 1: Missing Input Format Validation on Path Parameters

**Description:** The application extracts path parameters using regex patterns that are overly permissive. Specifically, the pattern `([^/]+)` accepts any character except forward slashes, including special characters, control characters, and injection payloads. While extracted parameters undergo some validation (existence checks, type checks), format validation matching expected patterns (e.g., UUID v4 for payment IDs) is inconsistently applied.

**Implication:** Path parameters that should conform to strict formats (UUIDs, 6-digit codes) can accept arbitrary strings. When these unconstrained inputs are used in downstream operations like database key construction, they create injection opportunities. Even though the application uses Redis (which has different injection characteristics than SQL), the lack of format validation creates unnecessary attack surface.

**Representative Vulnerability:** INJ-VULN-01 (NoSQL Injection via paymentId in GET /api/payments/:id/status)

### Pattern 2: Inconsistent Validation Rigor Across Endpoints

**Description:** The codebase demonstrates varying levels of validation rigor. Some endpoints implement comprehensive validation (type checks + format validation + range checks), while others perform only minimal checks (existence, type). For example:
- Strong validation: `code` parameter validated with `/^\d{6}$/` regex in multiple locations
- Weak validation: `paymentId` parameter only checked for existence in some handlers, not UUID format

**Implication:** This inconsistency creates blind spots where developers might assume validation exists based on patterns seen elsewhere. It also increases cognitive load during code review and makes it harder to ensure complete coverage.

**Representative Example:**
- Strong: `handleLinkPayment` validates code format (handlers.ts:174-175)
- Weak: `handlePaymentStatus` only checks paymentId existence (handlers.ts:234-236)

---

## 3. Strategic Intelligence for Exploitation

### Database Technology Confirmed

- **Database Type:** Redis (key-value store via Upstash REST API)
- **Storage Pattern:** Simple key-value pairs with TTL expiration
- **Injection Characteristics:** Unlike SQL databases, Redis has no query language to inject into. However, improper key construction can still lead to unauthorized data access
- **Client Library:** `@upstash/redis` v1.37.0 - HTTP REST API client (not raw Redis protocol)

### Defensive Measures Observed

- **Input Validation:** Most endpoints implement type checking and some format validation (e.g., regex for 6-digit codes, Solana PublicKey validation)
- **No Parameterized Queries:** Not applicable - Redis uses key-value operations, not SQL queries
- **String Interpolation:** Redis keys are constructed using template literals with user input (e.g., `` `payment:${paymentId}` ``)
- **No Rate Limiting:** Endpoints lack rate limiting, making brute-force enumeration feasible
- **Short TTLs:** Codes expire in 120s, payments in 300s - limits exposure window

### Error Disclosure Behavior

- **Error Messages:** Application returns generic error messages (e.g., "Missing payment ID")
- **No Verbose Errors:** No stack traces or Redis error messages leaked to clients
- **404 vs 400:** Invalid keys return 404 (not found) rather than exposing database errors

### Exploitation Recommendations

1. **NoSQL Injection (INJ-VULN-01):** The paymentId parameter lacks format validation. While Redis command injection is unlikely via the REST API, test for:
   - Special characters that might be interpreted differently by the Upstash client
   - Null bytes or control characters
   - Very long strings to test for buffer issues
   - Patterns like `payment:*` to see if wildcards are processed

2. **UUID Enumeration:** Although UUIDs have 128 bits of entropy (making brute-force infeasible), test for:
   - Predictable UUID generation patterns
   - Sequential or timestamp-based components
   - Information disclosure via timing attacks

---

## 4. Vectors Analyzed and Confirmed Secure

These input vectors were traced and confirmed to have robust, context-appropriate defenses or no injection risk.

| **Source (Parameter/Key)** | **Endpoint/File Location** | **Defense Mechanism Implemented** | **Verdict** |
|----------------------------|---------------------------|-----------------------------------|-------------|
| `walletPubkey` | POST /api/codes/generate | Solana PublicKey validation (base58 decode + format check) | SAFE |
| `code` | GET /api/codes/:code/resolve | Regex validation `/^\d{6}$/` enforces 6 digits only | SAFE |
| `code` | POST /api/payments/link | Regex validation `/^\d{6}$/` enforces 6 digits only | SAFE |
| `amount` | POST /api/payments/create | Type check (number) + range validation (> 0, ≤ 10,000) | SAFE |
| `merchantWallet` | POST /api/payments/create | Solana PublicKey validation (base58 decode + format check) | SAFE |
| `account` | POST /api/pay | Solana PublicKey validation (base58 decode + format check) | SAFE |
| `currency` | GET /api/price | Type cast to enum ("USD"\|"PLN"\|"EUR") | SAFE |

### Command Injection Vectors

**Status:** NOT VULNERABLE

**Analysis:** Comprehensive search for shell command execution patterns found zero instances in network-accessible code:
- No `child_process` module usage (exec, execSync, spawn, spawnSync, fork, execFile)
- No `eval()` with user input
- No `Function()` constructor with user input
- No third-party command execution libraries (shelljs, execa, cross-spawn)

**Files Verified:**
- `/packages/server/src/handlers.ts` - No command execution
- `/packages/server/src/storage.ts` - No command execution
- `/packages/server/src/adapters/nextjs.ts` - No command execution
- All SDK files (`/packages/sdk/src/`) - No command execution

### SQL Injection Vectors

**Status:** NOT APPLICABLE

**Analysis:** Application uses Redis (key-value store), not a SQL database:
- Zero SQL database dependencies (no pg, mysql, sqlite3, prisma, typeorm, sequelize, knex)
- Zero SQL query construction or execution
- Storage operations use only Redis key-value methods: `get()`, `set()`, `del()`

### Path Traversal / LFI / RFI Vectors

**Status:** NOT VULNERABLE

**Analysis:** No file system operations based on user input in network-accessible code:
- No `fs` module usage in runtime code
- No `require()` or `import()` with dynamic paths from user input
- Only two dynamic imports found, both with hardcoded paths:
  - `/packages/server/src/storage.ts:44` - `import("@upstash/redis")` (npm package)
  - `/packages/server/src/adapters/nextjs.ts:140` - `import("../price")` (relative module)

### SSTI (Server-Side Template Injection) Vectors

**Status:** NOT VULNERABLE

**Analysis:** No template engines used; application is a JSON API with client-side React:
- No template engine dependencies (no ejs, pug, handlebars, mustache, nunjucks)
- No server-side HTML rendering
- All endpoints return JSON via `Response.json()`
- React rendering is client-side only
- Only `eval` found is Redis Lua script execution (`redis.eval()`) with hardcoded script and parameterized arguments

### Deserialization Vectors

**Status:** SAFE

**Analysis:** All POST endpoints use `request.json()` with proper validation:
- POST /api/codes/generate: Type check + PublicKey validation on walletPubkey
- POST /api/payments/create: Type check + range validation on amount; PublicKey validation on merchantWallet
- POST /api/payments/link: Type check + regex validation on code; type check on paymentId
- POST /api/pay: Type check + PublicKey validation on account
- All handlers use destructuring to extract only expected fields
- No direct spreading of user input objects

**Note:** Minor weakness in POST /api/pay where body properties are accessed before validation (lines 242, 245 in adapters/nextjs.ts), but values are immediately validated in handler.

### Prototype Pollution Vectors

**Status:** SAFE

**Analysis:** Object spread operations only use trusted data:
- All handlers destructure to extract specific fields only (e.g., `const { walletPubkey } = input`)
- Update objects are constructed with explicit keys and validated values
- No user input objects are directly spread
- TypeScript type safety prevents extra properties
- No dangerous libraries (no lodash merge, no Object.assign with user data)

### SSRF (Server-Side Request Forgery) Vectors

**Status:** NOT VULNERABLE

**Analysis:** All external HTTP requests use hardcoded URLs:
- CoinGecko API: `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur` (hardcoded)
- Binance API: `https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT` (hardcoded)
- Kraken API: `https://api.kraken.com/0/public/Ticker?pair=SOLUSD` (hardcoded)
- Solana RPC: From environment variable `NEXT_PUBLIC_RPC_ENDPOINT` or `clusterApiUrl()` (not user input)
- Upstash Redis: From environment variable `UPSTASH_REDIS_REST_URL` (not user input)
- No user input can influence any HTTP request URL

---

## 5. Analysis Constraints and Blind Spots

### Upstash Redis Client Behavior

**Constraint:** The analysis assumes that the `@upstash/redis` client (v1.37.0) properly encodes and sanitizes Redis keys when making HTTP REST API calls. The actual encoding behavior of this client was not tested dynamically.

**Impact:** If the client has vulnerabilities in how it handles special characters in keys (e.g., newlines, null bytes, control characters), the NoSQL injection risk could be higher than assessed.

**Mitigation:** The REST API architecture provides a security layer compared to raw Redis protocol. Even if special characters reach the client, they are likely to be URL-encoded or rejected by the HTTP layer.

### UUID Generation Predictability

**Constraint:** The analysis assumes that `crypto.randomUUID()` (used for payment ID generation) provides truly random, unpredictable UUIDs. The quality of the entropy source was not verified.

**Impact:** If UUID generation is predictable or uses a weak entropy source, the 128-bit security assumption breaks down, making enumeration feasible.

**Blind Spot:** No analysis was performed on whether the Node.js/V8 environment provides cryptographically secure random UUID generation.

### Redis Lua Script Security

**Constraint:** The Lua script used for atomic compare-and-set operations (storage.ts:72-82) was analyzed statically. The script's behavior within the Redis environment and how Upstash processes it was not dynamically verified.

**Blind Spot:** While the script appears to use parameterized arguments correctly, subtle bugs in how `cjson.decode(ARGV[3])` handles malformed JSON could exist.

### Client-Side Validation Reliance

**Observation:** Some endpoints rely on client-side validation in React components before making API calls. This analysis focuses only on server-side validation, assuming an attacker will bypass client-side checks.

**Note:** This is correct security practice (never trust client-side validation), but it means some attack vectors that appear protected client-side are actually vulnerable server-side if validation is missing.

### No Dynamic Testing Performed

**Important:** This analysis is based entirely on static code review. No dynamic exploitation attempts were made. Therefore:
- Actual exploitability of INJ-VULN-01 was not confirmed
- Upstash client's encoding behavior was not observed in practice
- No timing attack testing was performed for UUID enumeration
- No fuzzing of special characters in Redis keys was conducted

---

