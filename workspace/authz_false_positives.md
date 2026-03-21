# Authorization False Positives Tracking

## AUTHZ-VULN-05: Code Enumeration on GET /api/codes/:code/resolve

**Status:** FALSE POSITIVE - FIXED

**Original Hypothesis:** The endpoint allows unauthenticated code enumeration to discover active payments.

**Attempted Exploitation:**
1. Created test payment and generated BLIK code (395864)
2. Attempted to resolve codes without providing wallet parameter
3. Attempted enumeration of 21 sequential codes (395854-395874)

**Results:**
- All requests returned HTTP 400: "Missing wallet parameter"
- Endpoint now requires wallet parameter (handlers.ts:86-88)
- Ownership verification implemented (handlers.ts:92-96)
- Cannot enumerate codes without knowing the owning wallet address

**Root Cause of False Positive:**
Analysis was based on outdated code. The vulnerability has been mitigated with:
1. Mandatory wallet parameter requirement
2. Wallet ownership verification before returning code data
3. Consistent error messages to prevent information leakage

**Code Evidence:**
```typescript
// File: /packages/server/src/handlers.ts:86-96
if (!wallet || typeof wallet !== "string") {
    throw new BlikError("Missing wallet parameter.", 400);
}

const codeData = await resolveCode(ctx.store, code);

// Return same 404 whether code doesn't exist or wallet doesn't match
// (prevents information leakage about which codes are active)
if (!codeData || codeData.walletPubkey !== wallet) {
    throw new BlikError("Code not found or expired.", 404);
}
```

**Conclusion:** The vulnerability has been properly fixed with wallet ownership verification. No exploitation possible.
