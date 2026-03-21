#!/usr/bin/env python3
"""
Global Rate Limit Test Script
Tests if the global rate limiter (500 req/10s) is enforced on the Solana BLIK API.

This script sends 60 rapid GET requests to measure:
- At what request number HTTP 429 is triggered
- Actual requests per second achieved
- Whether global rate limiting prevents distributed attacks
"""

import asyncio
import aiohttp
import time
from datetime import datetime
from typing import List, Dict, Tuple
import statistics

# Configuration
TARGET_URL = "https://solana-blik.vercel.app/api/codes/{code}/resolve?wallet=test123"
TEST_CODE = "123456"  # Test code to use
NUM_REQUESTS = 60
TIMEOUT_SECONDS = 30

class RateLimitTester:
    def __init__(self, url: str, num_requests: int):
        self.url = url
        self.num_requests = num_requests
        self.results: List[Dict] = []
        self.start_time = None
        self.end_time = None
        
    async def send_request(self, session: aiohttp.ClientSession, request_num: int) -> Dict:
        """Send a single request and record the result."""
        request_start = time.time()
        
        try:
            async with session.get(self.url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                request_end = time.time()
                
                # Read response body
                try:
                    response_text = await response.text()
                except:
                    response_text = "<unable to read>"
                
                return {
                    'request_num': request_num,
                    'status': response.status,
                    'timestamp': request_start,
                    'duration': request_end - request_start,
                    'response_preview': response_text[:200] if len(response_text) < 200 else response_text[:200] + "..."
                }
        except asyncio.TimeoutError:
            return {
                'request_num': request_num,
                'status': 'TIMEOUT',
                'timestamp': request_start,
                'duration': time.time() - request_start,
                'response_preview': 'Request timed out'
            }
        except Exception as e:
            return {
                'request_num': request_num,
                'status': 'ERROR',
                'timestamp': request_start,
                'duration': time.time() - request_start,
                'response_preview': str(e)
            }
    
    async def run_test(self):
        """Execute the rate limit test."""
        print("=" * 80)
        print("GLOBAL RATE LIMIT TEST")
        print("=" * 80)
        print(f"Target URL: {self.url}")
        print(f"Number of requests: {self.num_requests}")
        print(f"Expected global limit: 500 requests per 10 seconds")
        print(f"Test strategy: Send {self.num_requests} requests as fast as possible")
        print("=" * 80)
        print()
        
        # Create session with connection pooling
        connector = aiohttp.TCPConnector(limit=100, limit_per_host=100)
        async with aiohttp.ClientSession(connector=connector) as session:
            self.start_time = time.time()
            
            # Send all requests concurrently
            tasks = [
                self.send_request(session, i + 1)
                for i in range(self.num_requests)
            ]
            
            print(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Sending {self.num_requests} requests...")
            self.results = await asyncio.gather(*tasks)
            
            self.end_time = time.time()
        
        self.analyze_results()
    
    def analyze_results(self):
        """Analyze and display test results."""
        total_duration = self.end_time - self.start_time
        requests_per_second = self.num_requests / total_duration
        
        # Count status codes
        status_counts = {}
        first_429 = None
        successful_requests = 0
        
        for result in self.results:
            status = result['status']
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if status == 429 and first_429 is None:
                first_429 = result['request_num']
            
            if status == 200:
                successful_requests += 1
        
        # Calculate timing statistics
        durations = [r['duration'] for r in self.results if isinstance(r['duration'], (int, float))]
        avg_duration = statistics.mean(durations) if durations else 0
        min_duration = min(durations) if durations else 0
        max_duration = max(durations) if durations else 0
        
        # Print results
        print()
        print("=" * 80)
        print("TEST RESULTS")
        print("=" * 80)
        print()
        
        print("TIMING ANALYSIS:")
        print(f"  Total test duration: {total_duration:.3f} seconds")
        print(f"  Requests per second achieved: {requests_per_second:.2f} req/s")
        print(f"  Average response time: {avg_duration:.3f} seconds")
        print(f"  Min response time: {min_duration:.3f} seconds")
        print(f"  Max response time: {max_duration:.3f} seconds")
        print()
        
        print("RESPONSE STATUS CODES:")
        for status, count in sorted(status_counts.items()):
            percentage = (count / self.num_requests) * 100
            print(f"  {status}: {count} requests ({percentage:.1f}%)")
        print()
        
        print("RATE LIMITING ANALYSIS:")
        if 429 in status_counts:
            print(f"  ✓ Rate limiting detected!")
            print(f"  First 429 response at request: #{first_429}")
            print(f"  Successful requests before limit: {first_429 - 1 if first_429 else 0}")
            print(f"  Total blocked requests: {status_counts[429]}")
        else:
            print(f"  ✗ No rate limiting detected (no 429 responses)")
            print(f"  All {successful_requests} requests succeeded")
        print()
        
        # Global rate limit assessment
        expected_global_limit = 500
        expected_per_10s = expected_global_limit / 10  # 50 req/s
        
        print("GLOBAL RATE LIMIT ASSESSMENT:")
        print(f"  Expected global limit: {expected_global_limit} req/10s ({expected_per_10s} req/s)")
        print(f"  Achieved rate: {requests_per_second:.2f} req/s")
        
        if 429 in status_counts:
            # Calculate effective rate limit based on successful requests
            time_to_first_429 = next((r['timestamp'] - self.start_time for r in self.results if r['status'] == 429), total_duration)
            effective_rate = (first_429 - 1) / time_to_first_429 if time_to_first_429 > 0 else 0
            
            print(f"  Effective rate limit: ~{effective_rate:.2f} req/s")
            print()
            
            if effective_rate < expected_per_10s * 0.5:  # Less than 50% of expected
                print("  Status: ⚠️  RATE LIMIT IS ENFORCED (stricter than expected)")
                print(f"  The actual limit appears to be lower than the configured {expected_global_limit} req/10s")
            elif effective_rate < expected_per_10s * 1.5:  # Within reasonable range
                print("  Status: ✓ RATE LIMIT IS WORKING AS EXPECTED")
                print(f"  The global rate limiter is preventing excessive requests")
            else:
                print("  Status: ⚠️  RATE LIMIT MAY BE MISCONFIGURED")
                print(f"  More requests succeeded than expected for {expected_global_limit} req/10s limit")
        else:
            print()
            print("  Status: ✗ RATE LIMIT NOT ENFORCED")
            print(f"  WARNING: {self.num_requests} requests at {requests_per_second:.2f} req/s succeeded without limiting")
            print("  This suggests the global rate limiter is not active or misconfigured")
        
        print()
        print("=" * 80)
        print("DETAILED REQUEST LOG (first 10 and last 10 requests):")
        print("=" * 80)
        
        # Show first 10 requests
        print("\nFirst 10 requests:")
        for result in self.results[:10]:
            elapsed = result['timestamp'] - self.start_time
            print(f"  Request #{result['request_num']:3d} | "
                  f"Status: {str(result['status']):6s} | "
                  f"Time: +{elapsed:.3f}s | "
                  f"Duration: {result['duration']:.3f}s")
        
        # Show last 10 requests
        print("\nLast 10 requests:")
        for result in self.results[-10:]:
            elapsed = result['timestamp'] - self.start_time
            print(f"  Request #{result['request_num']:3d} | "
                  f"Status: {str(result['status']):6s} | "
                  f"Time: +{elapsed:.3f}s | "
                  f"Duration: {result['duration']:.3f}s")
        
        print()
        print("=" * 80)
        
        # Success criteria evaluation
        print("\nSUCCESS CRITERIA EVALUATION:")
        print("-" * 80)
        
        criteria_met = []
        
        # Criterion 1: Test completed
        criteria_met.append(True)
        print(f"  ✓ Test completed: {self.num_requests} requests sent in {total_duration:.3f}s")
        
        # Criterion 2: Rate limiting behavior identified
        if 429 in status_counts:
            criteria_met.append(True)
            print(f"  ✓ Rate limiting identified: First 429 at request #{first_429}")
        else:
            criteria_met.append(False)
            print(f"  ✗ No rate limiting detected: All requests succeeded")
        
        # Criterion 3: Prevents distributed attacks
        if 429 in status_counts and first_429 and first_429 <= 60:
            criteria_met.append(True)
            print(f"  ✓ Distributed attack prevention: Rate limit triggered within {self.num_requests} requests")
        else:
            criteria_met.append(False)
            print(f"  ✗ Distributed attack prevention: No effective limiting observed")
        
        print()
        if all(criteria_met):
            print("  OVERALL: ✓ SUCCESS - Global rate limiter is protecting the API")
        else:
            print("  OVERALL: ✗ FAILURE - Global rate limiter may not be effective")
        
        print("=" * 80)


async def main():
    """Main entry point."""
    url = TARGET_URL.format(code=TEST_CODE)
    tester = RateLimitTester(url, NUM_REQUESTS)
    await tester.run_test()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()

