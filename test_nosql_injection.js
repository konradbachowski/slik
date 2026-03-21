#!/usr/bin/env node
/**
 * NoSQL Injection Testing Script for Solana BLIK Payment Status Endpoint
 * Tests various injection payloads to identify potential vulnerabilities
 * 
 * Usage: node test_nosql_injection.js
 */

import https from 'https';

const BASE_URL = 'solana-blik.vercel.app';
const BASE_PATH = '/api/payments';

// Test payloads for NoSQL injection
const PAYLOADS = [
    { payload: 'test-basic', description: 'Baseline test - should return 404' },
    { payload: 'payment:*', description: 'Redis wildcard pattern - tests KEYS command injection' },
    { payload: 'payment:%00', description: 'Null byte injection - tests string termination bypass' },
    { payload: '../payment:test', description: 'Path traversal attempt - tests key manipulation' },
    { payload: 'test%0Akey', description: 'Newline injection - tests Redis command injection' },
    { payload: 'test%00%00%00', description: 'Multiple null bytes - tests buffer/parsing issues' },
];

function makeRequest(payload) {
    return new Promise((resolve, reject) => {
        const path = `${BASE_PATH}/${payload}/status`;
        
        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'Security-Test-Script/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    payload: payload,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    success: true
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                payload: payload,
                statusCode: null,
                headers: {},
                body: `Error: ${error.message}`,
                success: false
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                payload: payload,
                statusCode: null,
                headers: {},
                body: 'Error: Request timeout',
                success: false
            });
        });

        req.end();
    });
}

async function main() {
    console.log('='.repeat(80));
    console.log('NoSQL INJECTION TESTING - Payment Status Endpoint');
    console.log('='.repeat(80));
    console.log(`Target: https://${BASE_URL}${BASE_PATH}/:id/status`);
    console.log(`Testing ${PAYLOADS.length} payloads...\n`);

    const results = [];

    for (const { payload, description } of PAYLOADS) {
        console.log('-'.repeat(80));
        console.log(`Testing Payload: ${payload}`);
        console.log(`Description: ${description}`);
        console.log('-'.repeat(80));

        const result = await makeRequest(payload);
        results.push(result);

        if (result.success) {
            console.log(`Status Code: ${result.statusCode}`);
            
            // Parse and display body
            let bodyPreview = result.body.substring(0, 200);
            try {
                const jsonBody = JSON.parse(result.body);
                bodyPreview = JSON.stringify(jsonBody).substring(0, 200);
            } catch (e) {
                // Not JSON, use raw text
            }
            
            console.log(`Response Body (first 200 chars):`);
            console.log(`  ${bodyPreview}`);

            // Check for interesting headers
            const interestingHeaders = ['x-redis-key', 'x-error', 'content-type'];
            for (const header of interestingHeaders) {
                if (result.headers[header]) {
                    console.log(`Header [${header}]: ${result.headers[header]}`);
                }
            }
        } else {
            console.log(`Request Failed: ${result.body}`);
        }

        console.log();
    }

    // Analysis section
    console.log('='.repeat(80));
    console.log('ANALYSIS SUMMARY');
    console.log('='.repeat(80));

    // Status code distribution
    const statusCodes = {};
    for (const result of results) {
        if (result.success) {
            const code = result.statusCode;
            if (!statusCodes[code]) {
                statusCodes[code] = [];
            }
            statusCodes[code].push(result.payload);
        }
    }

    console.log('\nStatus Code Distribution:');
    for (const [code, payloads] of Object.entries(statusCodes).sort()) {
        console.log(`  ${code}: ${payloads.length} payload(s)`);
        for (const p of payloads) {
            console.log(`    - ${p}`);
        }
    }

    // Look for anomalies
    console.log('\nBehavior Anomalies:');
    const baseline = results[0];

    if (baseline && baseline.success) {
        const baselineCode = baseline.statusCode;
        let anomaliesFound = false;

        for (const result of results.slice(1)) {
            if (result.success && result.statusCode !== baselineCode) {
                anomaliesFound = true;
                console.log(`  - '${result.payload}': Different status code (${result.statusCode} vs ${baselineCode})`);
            }

            // Check for unexpected 200 responses
            if (result.success && result.statusCode === 200) {
                anomaliesFound = true;
                console.log(`  - '${result.payload}': Unexpected 200 OK response (possible injection)`);
            }
        }

        if (!anomaliesFound) {
            console.log('  No significant anomalies detected');
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SECURITY ASSESSMENT');
    console.log('='.repeat(80));
    console.log(`
Expected Secure Behavior:
  - All payloads should return consistent 404 responses
  - No information disclosure in error messages
  - No difference in response times or codes

Vulnerable Indicators:
  - Different status codes for injection payloads
  - 200 OK responses for crafted payloads
  - Error messages revealing Redis/database structure
  - Response time variations indicating backend query execution
    `);
}

main().catch(console.error);
