import https from "https";
import http from "http";

const BASE_URL = "https://solana-blik.vercel.app";

function makeRequest(path, method = "GET", body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "SecurityTester/1.0"
            }
        };
        
        if (body) {
            const bodyStr = JSON.stringify(body);
            options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
        }
        
        const protocol = url.protocol === "https:" ? https : http;
        
        const req = protocol.request(options, (res) => {
            let data = "";
            
            res.on("data", (chunk) => {
                data += chunk;
            });
            
            res.on("end", () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on("error", (error) => {
            reject(error);
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function testPayload(payloadName, payload, description = "") {
    console.log("\n" + "=".repeat(80));
    console.log(`Test: ${payloadName}`);
    console.log(`Payload: ${JSON.stringify(payload)}`);
    if (description) {
        console.log(`Description: ${description}`);
    }
    
    const path = `/api/payments/${payload}/status`;
    console.log(`URL: ${BASE_URL}${path}`);
    
    try {
        const response = await makeRequest(path);
        console.log(`Status Code: ${response.statusCode}`);
        console.log(`Content-Type: ${response.headers["content-type"] || "N/A"}`);
        
        try {
            const jsonResponse = JSON.parse(response.body);
            console.log(`Response: ${JSON.stringify(jsonResponse, null, 2).substring(0, 500)}`);
        } catch {
            console.log(`Response (text): ${response.body.substring(0, 500)}`);
        }
        
        return response;
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return null;
    }
}

async function createPayment() {
    console.log("\n" + "=".repeat(80));
    console.log("Creating Test Payment");
    const path = "/api/payments/create";
    console.log(`URL: ${BASE_URL}${path}`);
    
    const payload = {
        amount: 0.01,
        merchantWallet: "11111111111111111111111111111111"
    };
    
    console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
    
    try {
        const response = await makeRequest(path, "POST", payload);
        console.log(`Status Code: ${response.statusCode}`);
        console.log(`Content-Type: ${response.headers["content-type"] || "N/A"}`);
        
        try {
            const jsonResponse = JSON.parse(response.body);
            console.log(`Response: ${JSON.stringify(jsonResponse, null, 2)}`);
            return jsonResponse.paymentId;
        } catch {
            console.log(`Response (text): ${response.body}`);
            return null;
        }
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log("=".repeat(80));
    console.log("ENCODING BYPASS TESTING - Payment Status Endpoint");
    console.log("=".repeat(80));
    
    // Test 1: Valid UUID format (baseline)
    await testPayload(
        "Valid UUID",
        "550e8400-e29b-41d4-a716-446655440000",
        "Baseline test with valid UUID format"
    );
    
    // Test 2: Double URL encoding (null byte)
    await testPayload(
        "Double URL Encoded Null",
        "test%2500",
        "Attempting to bypass filters with double-encoded null byte"
    );
    
    // Test 3: Unicode null byte
    await testPayload(
        "Unicode Null",
        "test\\\\u0000",
        "Unicode representation of null byte"
    );
    
    // Test 4: Case variation
    await testPayload(
        "Case Variation",
        "PAYMENT:TEST",
        "Testing case sensitivity in validation"
    );
    
    // Test 5: Length boundary
    const longPayload = "A".repeat(500);
    await testPayload(
        "Length Boundary",
        longPayload,
        `Testing with very long string (${longPayload.length} chars)`
    );
    
    // Test 6: Redis CRLF injection
    await testPayload(
        "CRLF Injection",
        "test\\\\r\\\\nGET",
        "Attempting Redis command injection via CRLF"
    );
    
    // Additional encoding tests
    await testPayload(
        "Raw Null Byte Attempt",
        "test\\x00bypass",
        "Direct null byte in string"
    );
    
    await testPayload(
        "URL Encoded Null",
        "test%00bypass",
        "Single URL-encoded null byte"
    );
    
    await testPayload(
        "Hex Encoded",
        "test\\\\x00bypass",
        "Hex escape sequence"
    );
    
    // Test creating a real payment
    console.log("\n" + "=".repeat(80));
    console.log("ATTEMPTING TO CREATE REAL PAYMENT");
    console.log("=".repeat(80));
    
    const paymentId = await createPayment();
    
    if (paymentId) {
        console.log("\n" + "=".repeat(80));
        console.log(`Testing with Valid Payment ID: ${paymentId}`);
        console.log("=".repeat(80));
        
        await testPayload(
            "Valid Payment ID",
            paymentId,
            "Testing status check with legitimate payment ID"
        );
        
        // Test manipulation of valid payment ID
        if (paymentId.length > 5) {
            await testPayload(
                "Modified Payment ID",
                paymentId.slice(0, -1) + "X",
                "Testing with slightly modified valid payment ID"
            );
        }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("TESTING COMPLETE");
    console.log("=".repeat(80));
    console.log("\nSummary:");
    console.log("- Tested various encoding bypass techniques");
    console.log("- Attempted null byte injection via multiple encodings");
    console.log("- Tested CRLF injection for Redis command injection");
    console.log("- Tested case variations and length boundaries");
    console.log("- Attempted to create and test with valid payment IDs");
    console.log("\nAnalyze responses above for:");
    console.log("  1. Differences in error handling");
    console.log("  2. Any successful bypasses of null byte filter");
    console.log("  3. Information disclosure in error messages");
    console.log("  4. Patterns in valid payment ID structure");
}

main().catch(console.error);
