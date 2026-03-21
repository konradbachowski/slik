# Cache Control Headers Security Test

## Overview
This script tests whether sensitive API endpoints have proper cache control headers to prevent browsers and proxies from caching sensitive data.

## Test Script
- **File**: `test_cache_headers.py`
- **Language**: Python 3

## Requirements
```bash
pip install requests
```

## Usage
```bash
python3 test_cache_headers.py
```

## Endpoints Tested

### 1. POST /api/codes/generate
- **Purpose**: Generates BLIK payment codes
- **Sensitive Data**: Payment code
- **Request**:
  ```json
  {
    "walletAddress": "test123"
  }
  ```

### 2. POST /api/payments/create
- **Purpose**: Creates a payment transaction
- **Sensitive Data**: Payment ID and transaction details
- **Request**:
  ```json
  {
    "code": "123456",
    "amount": 100,
    "merchantId": "test-merchant"
  }
  ```

### 3. GET /api/payments/{id}/status
- **Purpose**: Retrieves payment status
- **Sensitive Data**: Payment details, amount, status
- **Request**: GET request with payment ID in URL

## Headers Checked

For each endpoint, the script checks:

1. **Cache-Control**: Should contain `no-store` for sensitive data
2. **Pragma**: Optional legacy cache control header
3. **Expires**: Optional expiration time header

## Vulnerability Detection

The script identifies endpoints as **VULNERABLE** if:

- Missing `Cache-Control` header entirely
- `Cache-Control` is present but missing `no-store` directive
- `Cache-Control` allows caching (e.g., `public`, `max-age`)

Endpoints are marked **SAFE** if:

- `Cache-Control: no-store` is present

## Example Output

```
================================================================================
Cache Control Header Security Test - 2026-03-21 10:30:00
================================================================================

Testing endpoints for proper cache control headers on sensitive data...

================================================================================
Testing: POST /api/codes/generate
================================================================================

Status Code: 200
Response Body: {
  "code": "123456",
  "expiresAt": "2026-03-21T10:36:00Z"
}

Cache-Related Headers:
  Cache-Control: NOT SET
  Pragma: NOT SET
  Expires: NOT SET

[VULNERABLE] POST /api/codes/generate
Reason: Missing Cache-Control header entirely

...

================================================================================
SUMMARY
================================================================================

VULNERABLE ENDPOINTS (3):
  - POST /api/codes/generate
  - POST /api/payments/create
  - GET /api/payments/{id}/status

OVERALL: VULNERABLE
Found 3 endpoint(s) with improper cache control headers.

Recommendation: Add "Cache-Control: no-store" header to all sensitive endpoints
```

## Security Impact

### Why This Matters

Without proper cache control headers, sensitive payment data can be:

- **Cached by browsers**: Stored in browser cache, accessible to anyone using the same device
- **Cached by proxies**: Stored in intermediate proxies, potentially exposing data to third parties
- **Stored in browser history**: Accessible through browser developer tools
- **Saved in disk cache**: Persisted to disk, potentially accessible after user logout

### OWASP Reference

This vulnerability relates to:
- **OWASP Top 10 2021 - A01:2021 Broken Access Control**
- **OWASP ASVS V8.3.3**: Verify that sensitive data is sent to the server in the HTTP message body or headers and that query string parameters from any HTTP verb do not contain sensitive data.

## Recommended Fix

Add the following headers to all sensitive endpoints:

```javascript
// Next.js API Route example
export default function handler(req, res) {
  // Set cache control headers
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  // ... rest of handler logic
}
```

## Success Criteria

The test is successful when it identifies:

1. Which endpoints return sensitive data
2. Which endpoints lack proper cache control headers
3. Clear verdict (VULNERABLE/SAFE) for each endpoint
4. Overall security assessment
5. Actionable remediation recommendations
