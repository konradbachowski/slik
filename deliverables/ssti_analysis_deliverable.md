# Server-Side Template Injection (SSTI) Vulnerability Analysis

**Application:** SolanaBLIK
**Analysis Date:** 2026-03-21
**Vulnerability Class:** Server-Side Template Injection (SSTI)
**Severity Assessment:** NOT VULNERABLE

---

## Executive Summary

After comprehensive analysis of the SolanaBLIK application's server-side code, **NO Server-Side Template Injection (SSTI) vulnerabilities were found**. The application is a JSON API that does not use any template engines for server-side rendering. All dynamic HTML generation occurs client-side via React, eliminating the attack surface for SSTI vulnerabilities.

---

## Analysis Methodology

### 1. Template Engine Detection
Searched for common template engine imports and usage:
- **Engines Checked:** ejs, pug, handlebars, mustache, nunjucks, twig, jade, hbs, dot, underscore, lodash.template
- **Result:** No template engine dependencies found in `package.json` or server code

### 2. Dynamic Code Execution Patterns
Searched for dangerous patterns that could enable code execution:
- `eval()` calls with user input
- `Function()` constructor usage
- `new Function()` patterns
- Template literal evaluation with user data

### 3. Server-Side Rendering Analysis
- Verified no server-side HTML rendering
- Confirmed Next.js is used for React SSR only (safe, no user template input)
- Checked for `renderToString` / `renderToStaticMarkup` usage

### 4. API Response Analysis
- All server responses are JSON-only
- No HTML generation in API handlers
- No dynamic template compilation

---

## Application Architecture

### Technology Stack
- **Framework:** Next.js 16.2.0 (App Router)
- **Frontend:** React 19.2.4 (Client-Side Rendering)
- **Backend:** Custom JSON API handlers
- **No Template Engines Present**

### Server-Side Code Structure

```
/packages/server/src/
├── handlers.ts          # JSON API route handlers
├── storage.ts           # Redis/memory data storage
├── price.ts             # SOL price fetching
├── ratelimit.ts         # Rate limiting logic
├── types.ts             # TypeScript interfaces
└── adapters/nextjs.ts   # Next.js API route adapter
```

### API Endpoints (All JSON)
1. `POST /codes/generate` - Generate payment code
2. `GET /codes/:code/resolve` - Resolve code to payment
3. `POST /payments/create` - Create payment
4. `POST /payments/link` - Link code to payment
5. `GET /payments/:id/status` - Get payment status
6. `POST /pay` - Generate Solana transaction
7. `GET /price` - Get SOL prices

**All endpoints return JSON responses only** via `Response.json()`.

---

## Detailed Findings

### 1. No Template Engine Dependencies

**File Analyzed:** `/Users/mac/kodziki/apps/solana-blik/package.json`

```json
{
  "dependencies": {
    "@coral-xyz/anchor": "^0.30.1",
    "@solana/pay": "^0.2.6",
    "@solana/spl-token": "^0.4.14",
    "@solana/wallet-adapter-react": "^0.15.39",
    "@solana/web3.js": "^1.98.4",
    "@upstash/redis": "^1.37.0",
    "bignumber.js": "^10.0.2",
    "next": "16.2.0",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "uuid": "^13.0.0"
  }
}
```

**Verification:** No ejs, pug, handlebars, mustache, nunjucks, twig, jade, or any other template engine present.

---

### 2. No Dynamic Code Execution

**Eval Usage Analysis:**

Only ONE instance of `eval` found in the entire codebase:

**File:** `/Users/mac/kodziki/apps/solana-blik/packages/server/src/storage.ts:83`

```typescript
async setIfMatch(
  key: string,
  matchField: string,
  matchValue: unknown,
  updates: Record<string, unknown>,
  ttlSeconds: number
): Promise<boolean> {
  const redis = await getRedis();
  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    if not current then return 0 end
    local data = cjson.decode(current)
    if tostring(data[ARGV[1]]) ~= ARGV[2] then return 0 end
    for k, v in pairs(cjson.decode(ARGV[3])) do
      data[k] = v
    end
    redis.call('SET', KEYS[1], cjson.encode(data), 'EX', tonumber(ARGV[4]))
    return 1
  `;
  const result = await redis.eval(
    luaScript,
    [key],
    [matchField, String(matchValue), JSON.stringify(updates), String(ttlSeconds)]
  );
  return result === 1;
}
```

**Assessment:** SAFE
- This is Redis Lua script execution via `redis.eval()`
- Lua script is hardcoded (not user-controlled)
- User input is passed as **arguments** to the script, not injected into the script string
- Arguments are properly typed and serialized (`String()`, `JSON.stringify()`)
- This is the standard and secure way to use Redis EVAL for atomic operations

---

### 3. JSON-Only API Responses

**File:** `/Users/mac/kodziki/apps/solana-blik/packages/server/src/adapters/nextjs.ts`

All responses use `Response.json()`:

```typescript
// Example GET handler
async GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // GET /codes/:code/resolve
    const codeMatch = path.match(/\/codes\/(\d{6})\/resolve$/);
    if (codeMatch) {
      const result = await handlers.handleResolveCode(ctx, {
        code: codeMatch[1],
      });
      return Response.json(result);  // ← JSON response
    }

    // Other routes...
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    if (err instanceof BlikError) {
      return Response.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Verification:** No HTML generation, no template rendering, only structured JSON.

---

### 4. Client-Side React Rendering

**File:** `/Users/mac/kodziki/apps/solana-blik/src/app/layout.tsx`

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">
        <AppWalletProvider>{children}</AppWalletProvider>
      </body>
    </html>
  );
}
```

**Next.js Configuration:** `/Users/mac/kodziki/apps/solana-blik/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
};
```

**Assessment:**
- Next.js App Router with React Server Components
- No custom HTML template rendering
- React components are compiled/rendered by Next.js (no user input in templates)
- Client-side hydration only

---

### 5. No `dangerouslySetInnerHTML` with User Input

**Search Results:** Only found in deliverable documentation files, not in source code.

**Verification:** No dynamic HTML injection patterns in the application code.

---

## Attack Surface Analysis

### Potential SSTI Entry Points (All Secure)

| Entry Point | User Input | Rendering Method | SSTI Risk |
|-------------|-----------|------------------|-----------|
| `/codes/generate` | `walletPubkey` | JSON response | None |
| `/codes/:code/resolve` | `code` | JSON response | None |
| `/payments/create` | `amount`, `merchantWallet` | JSON response | None |
| `/payments/link` | `paymentId`, `code` | JSON response | None |
| `/payments/:id/status` | `paymentId` | JSON response | None |
| `/pay` | `paymentId`, `account` | JSON response | None |
| `/price` | `currency` query param | JSON response | None |

**All user inputs are:**
1. Validated and sanitized
2. Stored in Redis (JSON serialized)
3. Returned in JSON responses only
4. Never passed to any template engine
5. Never evaluated as code

---

## Security Controls Verified

### 1. Input Validation
All handlers perform strict input validation:

```typescript
// Example from handlers.ts
export async function handleGenerateCode(
  ctx: HandlerContext,
  input: { walletPubkey: string }
): Promise<{ code: string; expiresIn: number }> {
  const { walletPubkey } = input;

  if (!walletPubkey || typeof walletPubkey !== "string") {
    throw new BlikError("Missing or invalid walletPubkey.", 400);
  }

  // Validate that it's a legit Solana public key
  try {
    new PublicKey(walletPubkey);
  } catch {
    throw new BlikError("Invalid Solana public key format.", 400);
  }

  const code = await createPaymentCode(ctx.store, walletPubkey);
  return { code, expiresIn: 120 };
}
```

### 2. Type Safety
- Full TypeScript implementation
- Strict type checking on all inputs
- No `any` types in critical paths

### 3. JSON Serialization Only
- All data storage uses `JSON.stringify()`
- All API responses use `Response.json()`
- No string concatenation for output generation

### 4. No Dynamic Code Generation
- No `eval()` with user input
- No `Function()` constructor usage
- No template literal evaluation with user data
- Redis Lua scripts are static and parameterized

---

## False Positive Analysis

### Grep Results Requiring Investigation

**Pattern:** `\beval\s*\(`
**Files Found:**
1. `package-lock.json` - Dependency metadata (not code)
2. `deliverables/*.md` - Documentation files (not code)
3. `packages/server/src/storage.ts` - Redis Lua eval (analyzed above, SAFE)

**Conclusion:** No actual SSTI vulnerabilities found.

---

## Threat Modeling

### SSTI Attack Scenarios (All Mitigated)

#### Scenario 1: Template Injection via Code Input
**Vector:** User generates code with malicious template payload
```
POST /codes/generate
{ "walletPubkey": "{{7*7}}" }
```

**Mitigation:**
- Wallet pubkey validated as Base58-encoded Solana address
- Invalid format rejected with 400 error
- No template rendering occurs
- Value stored as-is in Redis, returned in JSON

**Result:** NOT VULNERABLE

---

#### Scenario 2: Template Injection via Payment Amount
**Vector:** Attacker sends template syntax in amount field
```
POST /payments/create
{ "amount": "{{process.env}}", "merchantWallet": "..." }
```

**Mitigation:**
- Amount validated as `typeof amount === 'number'`
- Non-numeric values rejected
- No template processing
- JSON serialization only

**Result:** NOT VULNERABLE

---

#### Scenario 3: Lua Script Injection via Redis
**Vector:** Inject malicious Lua code via atomicLinkPayment
```
POST /payments/link
{ "paymentId": "'; return redis.call('FLUSHALL') --", "code": "123456" }
```

**Mitigation:**
- Lua script is static/hardcoded
- User input passed as **arguments** (ARGV), not concatenated into script
- Redis properly escapes arguments
- Script structure:
  ```lua
  -- Script is static
  local data = cjson.decode(ARGV[3])  -- User data is in ARGV, not in script
  ```

**Result:** NOT VULNERABLE

---

## Comparison with OWASP Guidelines

### OWASP Top 10 2021 - A03: Injection

**Requirement:** Prevent template injection by:
1. Not using template engines OR
2. Sandboxing template execution OR
3. Using logic-less templates

**SolanaBLIK Implementation:**
- **Approach:** Option 1 - No template engines used
- **Compliance:** FULLY COMPLIANT
- Application is a pure JSON API with client-side React rendering

---

## Recommendations

### Current Security Posture: EXCELLENT ✅

The application has NO SSTI vulnerabilities because:
1. No template engines are present
2. No server-side HTML rendering
3. All responses are JSON
4. React rendering is client-side
5. Redis Lua scripts are properly parameterized

### Best Practices to Maintain

1. **Continue Using JSON APIs**
   - Keep all API responses as JSON
   - Avoid adding server-side HTML rendering

2. **If Adding Template Engines (NOT RECOMMENDED)**
   - Use logic-less templates (Mustache)
   - Enable auto-escaping
   - Sandbox template execution
   - Never pass user input directly to templates

3. **Code Review Checklist**
   - Reject PRs that introduce template engines
   - Review any new `eval()` usage carefully
   - Ensure new API endpoints return JSON only

4. **Dependency Monitoring**
   - Monitor for accidental template engine additions
   - Review transitive dependencies

---

## Testing Performed

### 1. Static Code Analysis
- ✅ Searched entire codebase for template engine imports
- ✅ Identified all `eval()` usage (only Redis Lua)
- ✅ Verified no `Function()` constructor usage
- ✅ Confirmed no server-side HTML rendering

### 2. Dependency Analysis
- ✅ Reviewed package.json for template engines
- ✅ Confirmed no ejs, pug, handlebars, etc.

### 3. API Response Analysis
- ✅ Verified all routes return JSON
- ✅ Confirmed no HTML/XML responses

### 4. React SSR Review
- ✅ Confirmed Next.js SSR is safe (no user template input)
- ✅ No `dangerouslySetInnerHTML` with user data

---

## Conclusion

**FINAL VERDICT: NO SSTI VULNERABILITIES PRESENT**

The SolanaBLIK application is **NOT VULNERABLE** to Server-Side Template Injection attacks. The application architecture inherently prevents SSTI by:

1. **No Template Engines** - Zero template engine dependencies
2. **JSON API** - All server responses are structured JSON
3. **Client-Side Rendering** - React handles all dynamic HTML on the client
4. **Parameterized Redis** - Lua scripts use safe argument passing
5. **Strong Input Validation** - All user inputs are validated and typed

**Security Rating:** 🟢 **SECURE - NO ACTION REQUIRED**

The only `eval()` usage is for parameterized Redis Lua scripts, which is the standard secure pattern for atomic operations.

---

## References

- OWASP Server-Side Template Injection: https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection
- PortSwigger SSTI: https://portswigger.net/web-security/server-side-template-injection
- Redis EVAL Security: https://redis.io/commands/eval/#script-parameterization

---

**Report Generated By:** Claude Sonnet 4.5
**Analysis Date:** 2026-03-21
