# Quick Start: Cache Control Headers Test

## Run the Test

```bash
# Install dependencies
pip install requests

# Run the test
python3 test_cache_headers.py
```

## What It Does

Tests 3 sensitive endpoints for proper cache control headers:

1. **POST /api/codes/generate** - Generates payment codes
2. **POST /api/payments/create** - Creates payment transactions
3. **GET /api/payments/{id}/status** - Retrieves payment status

## Expected Behavior

For each endpoint, the script:
- Makes a request
- Checks response headers for Cache-Control, Pragma, Expires
- Determines if sensitive data lacks `Cache-Control: no-store`
- Prints VULNERABLE or SAFE verdict

## Vulnerability Criteria

**VULNERABLE** if:
- No Cache-Control header
- Cache-Control missing `no-store`
- Cache-Control allows caching

**SAFE** if:
- Has `Cache-Control: no-store`

## Output Example

```
[VULNERABLE] POST /api/codes/generate
Reason: Missing Cache-Control header entirely

Cache-Related Headers:
  Cache-Control: NOT SET
  Pragma: NOT SET
  Expires: NOT SET
```

## Fix

Add to sensitive API routes:

```javascript
res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
```
