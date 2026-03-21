# Global Rate Limit Test Script

## Overview
This script tests whether the global rate limiter (configured for 500 requests per 10 seconds) is properly enforced on the Solana BLIK API.

## Test Configuration
- **Target Endpoint**: https://solana-blik.vercel.app/api/codes/{code}/resolve?wallet=test123
- **Method**: GET
- **Number of Requests**: 60 requests sent as fast as possible
- **Expected Global Limit**: 500 requests per 10 seconds (50 req/s)

## What the Test Does
The script will:
1. Send 60 concurrent GET requests to the API endpoint
2. Track which request number triggers HTTP 429 (Too Many Requests)
3. Measure the actual requests per second achieved
4. Calculate the effective rate limit based on when 429s start appearing
5. Determine if the global rate limiter prevents distributed attacks

## Requirements
- Python 3.7+
- aiohttp library

## Installation
```bash
# Install required dependencies
pip install aiohttp

# Or if using pip3
pip3 install aiohttp
```

## Usage
```bash
# Run the test script
python3 test_global_rate_limit.py

# Or make it executable and run directly
chmod +x test_global_rate_limit.py
./test_global_rate_limit.py
```

## Expected Output
The script will display:
- Timing analysis (total duration, requests/second achieved)
- Response status code distribution
- Rate limiting analysis (first 429 response, total blocked)
- Global rate limit assessment
- Detailed request logs
- Success criteria evaluation

## Success Criteria
The test passes if:
1. ✓ Test completes successfully with all 60 requests sent
2. ✓ HTTP 429 responses are detected (rate limiting is active)
3. ✓ Rate limit is triggered within 60 requests (prevents attacks)

## Configuration Options
You can modify these variables at the top of the script:
- `TEST_CODE`: BLIK code to test (default: "123456")
- `NUM_REQUESTS`: Number of requests to send (default: 60)
- `TIMEOUT_SECONDS`: Timeout for the entire test (default: 30)

## Interpreting Results

### Rate Limit Working Correctly
```
Status: ✓ RATE LIMIT IS WORKING AS EXPECTED
The global rate limiter is preventing excessive requests
```

### Rate Limit Too Strict
```
Status: ⚠️  RATE LIMIT IS ENFORCED (stricter than expected)
The actual limit appears to be lower than the configured 500 req/10s
```

### Rate Limit Not Working
```
Status: ✗ RATE LIMIT NOT ENFORCED
WARNING: 60 requests at XX.XX req/s succeeded without limiting
This suggests the global rate limiter is not active or misconfigured
```

## Example Output
```
================================================================================
GLOBAL RATE LIMIT TEST
================================================================================
Target URL: https://solana-blik.vercel.app/api/codes/123456/resolve?wallet=test123
Number of requests: 60
Expected global limit: 500 requests per 10 seconds
Test strategy: Send 60 requests as fast as possible
================================================================================

[12:34:56.789] Sending 60 requests...

================================================================================
TEST RESULTS
================================================================================

TIMING ANALYSIS:
  Total test duration: 5.234 seconds
  Requests per second achieved: 11.46 req/s
  Average response time: 0.523 seconds
  Min response time: 0.234 seconds
  Max response time: 1.234 seconds

RESPONSE STATUS CODES:
  200: 45 requests (75.0%)
  429: 15 requests (25.0%)

RATE LIMITING ANALYSIS:
  ✓ Rate limiting detected!
  First 429 response at request: #46
  Successful requests before limit: 45
  Total blocked requests: 15

GLOBAL RATE LIMIT ASSESSMENT:
  Expected global limit: 500 req/10s (50 req/s)
  Achieved rate: 11.46 req/s
  Effective rate limit: ~45.00 req/s

  Status: ✓ RATE LIMIT IS WORKING AS EXPECTED
  The global rate limiter is preventing excessive requests
```

## Troubleshooting

### ModuleNotFoundError: No module named aiohttp
Install the required dependency:
```bash
pip install aiohttp
```

### Connection Errors
- Check your internet connection
- Verify the API endpoint is accessible
- The endpoint may be experiencing downtime

### All Requests Timing Out
- The API may be under heavy load
- Try reducing NUM_REQUESTS
- Increase TIMEOUT_SECONDS in the script

## Security Considerations
This script is designed for security testing purposes only. It should:
- Only be run against APIs you have permission to test
- Use test data that does not expose sensitive information
- Be run in a controlled environment to avoid unintended impact

