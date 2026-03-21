# Authentication False Positives Tracking

## AUTH-VULN-03: Distributed Brute-Force Code Enumeration

**Vulnerability ID:** AUTH-VULN-03
**Classification:** FALSE POSITIVE
**Date Tested:** 2024

### Original Hypothesis
The 6-digit code space (900K codes) with 120s TTL could be fully enumerated using 750 distributed IPs at 10 req/s each, achieving 100% coverage within the TTL window.

### Why It's a False Positive

**Defense Implemented:**
1. **Global Rate Limiter**: Code at `/packages/server/src/adapters/nextjs.ts:138-144` implements a global rate limit of 500 req/10s across ALL IPs
2. **Wallet Parameter Required**: The `/api/codes/:code/resolve` endpoint now requires a `wallet` query parameter (line 150), preventing blind enumeration
3. **Lockout Mechanism**: IP lockout after repeated failed attempts (lines 103-120)

**Attack Prevention:**
- Maximum global throughput: 50 req/s (500 req/10s)
- Required knowledge: Both code AND wallet address
- Time to enumerate 900K codes: 5 hours (vs. theoretical 120s)
- Codes expire in 120s, making enumeration infeasible

### Attempted Exploitation
- Tested code enumeration with 100 sequential requests
- Rate limiting kicked in after ~30 requests with HTTP 429
- Global limit prevents distributed attack scaling

### Conclusion
The vulnerability was mitigated by:
1. Adding global rate limiter (not just per-IP)
2. Requiring wallet parameter for code resolution
3. Implementing IP lockout mechanism

**Verdict:** Security controls successfully prevent the attack described in the original hypothesis.

---

## AUTH-VULN-04: Cache Recovery via Missing Cache-Control Headers

**Vulnerability ID:** AUTH-VULN-04
**Classification:** OUT_OF_SCOPE_INTERNAL
**Date Tested:** 2024

### Original Hypothesis
Missing Cache-Control headers on authentication responses could allow attackers to recover sensitive tokens from browser/proxy caches.

### Why It's Out of Scope

**Exploitation Requirements:**
1. **Browser Cache Access**: Requires physical access to victim's computer or malware installation
2. **Proxy Cache Access**: Requires control over network infrastructure (shared proxy)
3. **Forensic Recovery**: Requires disk access to victim's device

**External Network Exploitation:** NOT POSSIBLE

This vulnerability cannot be exploited purely through network requests from an external position. It requires:
- Local file system access to browser cache
- OR man-in-the-middle position with proxy control
- OR malware/physical access to victim's machine

### Technical Finding
Confirmed: Application does NOT set Cache-Control: no-store headers on sensitive endpoints:
- POST /api/codes/generate
- POST /api/payments/create
- GET /api/payments/:id/status

However, this is a **defense-in-depth issue**, not an externally exploitable authentication bypass.

### Conclusion
While the missing Cache-Control header is a security weakness, it does not meet the criteria for authentication exploitation from external network position.

**Verdict:** Requires internal/local access - classified as OUT_OF_SCOPE_INTERNAL per exploitation constraints.

---

## AUTH-VULN-05: SSL Stripping via Missing HSTS Header

**Vulnerability ID:** AUTH-VULN-05
**Classification:** FALSE POSITIVE
**Date Tested:** 2024

### Original Hypothesis
Missing Strict-Transport-Security (HSTS) header would allow SSL stripping attacks on initial connection.

### Why It's a False Positive

**Defense Implemented:**
Vercel infrastructure automatically provides HSTS header at the edge layer.

**Confirmed HSTS Configuration:**
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Protection Details:**
- Max-age: 63,072,000 seconds (2 years)
- includeSubDomains: YES - applies to all subdomains
- preload: YES - eligible for browser HSTS preload lists

### Verification
Tested with direct HTTP request to https://solana-blik.vercel.app

**Response Headers Include:**
- Strict-Transport-Security header with 2-year max-age
- Infrastructure-level enforcement (Vercel CDN)
- Preload directive for browser inclusion

### Attempted Exploitation
- SSL stripping attack NOT POSSIBLE due to HSTS enforcement
- Browsers with HSTS record will refuse HTTP connections
- Preload list inclusion prevents initial HTTP connection

### Conclusion
While the application code at `/src/middleware.ts` does not set HSTS, Vercel's infrastructure provides it automatically with strong security parameters.

**Verdict:** SSL stripping attacks are prevented by infrastructure-level HSTS. The vulnerability analysis was based on application code only and missed the platform-level security controls.
