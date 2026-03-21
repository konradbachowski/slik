#\!/usr/bin/env python3
"""
Security Test: Cache Control Headers
Tests if sensitive endpoints have proper cache control headers to prevent caching of sensitive data.
"""

import requests
import json
from datetime import datetime

# ANSI color codes
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

BASE_URL = "https://solana-blik.vercel.app"

def print_header(text):
    """Print formatted section header"""
    print(f"\n{BLUE}{\"=\" * 80}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{\"=\" * 80}{RESET}\n")

def print_result(endpoint, verdict, reason):
    """Print formatted test result"""
    color = RED if verdict == "VULNERABLE" else GREEN
    print(f"\n{color}[{verdict}]{RESET} {endpoint}")
    print(f"Reason: {reason}\n")

def check_cache_headers(headers):
    """Check if response has proper cache control for sensitive data"""
    cache_headers = {
        "Cache-Control": headers.get("Cache-Control", "NOT SET"),
        "Pragma": headers.get("Pragma", "NOT SET"),
        "Expires": headers.get("Expires", "NOT SET")
    }
    
    cache_control = headers.get("Cache-Control", "").lower()
    
    # Check if no-store is present
    if "no-store" in cache_control:
        return False, "Has Cache-Control: no-store (secure)", cache_headers
    
    # Check if no-cache is present (less secure than no-store)
    if "no-cache" in cache_control:
        return True, "Has no-cache but missing no-store (weak protection)", cache_headers
    
    # No cache control at all
    if not cache_control:
        return True, "Missing Cache-Control header entirely", cache_headers
    
    # Has cache control but allows caching
    return True, f"Cache-Control present but allows caching: {cache_control}", cache_headers

def test_generate_code():
    """Test POST /api/codes/generate"""
    endpoint = "POST /api/codes/generate"
    print_header(f"Testing: {endpoint}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/codes/generate",
            json={"walletAddress": "test123"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        is_vulnerable, reason, cache_headers = check_cache_headers(response.headers)
        
        print(f"\nCache-Related Headers:")
        for header, value in cache_headers.items():
            print(f"  {header}: {value}")
        
        verdict = "VULNERABLE" if is_vulnerable else "SAFE"
        print_result(endpoint, verdict, reason)
        
        return is_vulnerable
        
    except requests.exceptions.RequestException as e:
        print(f"{RED}Error: {e}{RESET}")
        return None

def test_create_payment():
    """Test POST /api/payments/create"""
    endpoint = "POST /api/payments/create"
    print_header(f"Testing: {endpoint}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/payments/create",
            json={
                "code": "123456",
                "amount": 100,
                "merchantId": "test-merchant"
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        is_vulnerable, reason, cache_headers = check_cache_headers(response.headers)
        
        print(f"\nCache-Related Headers:")
        for header, value in cache_headers.items():
            print(f"  {header}: {value}")
        
        verdict = "VULNERABLE" if is_vulnerable else "SAFE"
        print_result(endpoint, verdict, reason)
        
        # Return both vulnerability status and payment ID for next test
        payment_id = None
        if response.status_code == 200 or response.status_code == 201:
            try:
                payment_id = response.json().get("paymentId")
            except:
                pass
        
        return is_vulnerable, payment_id
        
    except requests.exceptions.RequestException as e:
        print(f"{RED}Error: {e}{RESET}")
        return None, None

def test_payment_status(payment_id=None):
    """Test GET /api/payments/{id}/status"""
    endpoint = "GET /api/payments/{id}/status"
    print_header(f"Testing: {endpoint}")
    
    if not payment_id:
        payment_id = "test-payment-id-123"
        print(f"{YELLOW}Note: Using placeholder payment_id: {payment_id}{RESET}\n")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/payments/{payment_id}/status",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        is_vulnerable, reason, cache_headers = check_cache_headers(response.headers)
        
        print(f"\nCache-Related Headers:")
        for header, value in cache_headers.items():
            print(f"  {header}: {value}")
        
        verdict = "VULNERABLE" if is_vulnerable else "SAFE"
        print_result(endpoint, verdict, reason)
        
        return is_vulnerable
        
    except requests.exceptions.RequestException as e:
        print(f"{RED}Error: {e}{RESET}")
        return None

def main():
    """Run all cache header tests"""
    print_header(f"Cache Control Header Security Test - {datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}")
    
    print(f"{YELLOW}Testing endpoints for proper cache control headers on sensitive data...{RESET}\n")
    
    vulnerabilities = []
    
    # Test 1: Generate Code
    result1 = test_generate_code()
    if result1 is not None:
        vulnerabilities.append(("POST /api/codes/generate", result1))
    
    # Test 2: Create Payment
    result2, payment_id = test_create_payment()
    if result2 is not None:
        vulnerabilities.append(("POST /api/payments/create", result2))
    
    # Test 3: Payment Status
    result3 = test_payment_status(payment_id)
    if result3 is not None:
        vulnerabilities.append(("GET /api/payments/{id}/status", result3))
    
    # Summary
    print_header("SUMMARY")
    
    vulnerable_endpoints = [ep for ep, vuln in vulnerabilities if vuln]
    safe_endpoints = [ep for ep, vuln in vulnerabilities if not vuln]
    
    if vulnerable_endpoints:
        print(f"{RED}VULNERABLE ENDPOINTS ({len(vulnerable_endpoints)}):{RESET}")
        for endpoint in vulnerable_endpoints:
            print(f"  - {endpoint}")
    
    if safe_endpoints:
        print(f"\n{GREEN}SAFE ENDPOINTS ({len(safe_endpoints)}):{RESET}")
        for endpoint in safe_endpoints:
            print(f"  - {endpoint}")
    
    # Final verdict
    if vulnerable_endpoints:
        print(f"\n{RED}OVERALL: VULNERABLE{RESET}")
        print(f"Found {len(vulnerable_endpoints)} endpoint(s) with improper cache control headers.")
        print(f"\n{YELLOW}Recommendation:{RESET} Add \"Cache-Control: no-store\" header to all sensitive endpoints")
    else:
        print(f"\n{GREEN}OVERALL: SAFE{RESET}")
        print("All tested endpoints have proper cache control headers.")
    
    print(f"\n{BLUE}{\"=\" * 80}{RESET}\n")

if __name__ == "__main__":
    main()
