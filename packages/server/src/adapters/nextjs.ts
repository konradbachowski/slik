import type { Connection } from "@solana/web3.js";
import type { Store } from "../storage";
import type { RateLimitResult } from "../ratelimit";
import { checkRateLimit, DEFAULT_RATE_LIMITS } from "../ratelimit";
import * as handlers from "../handlers";
import { SlikError } from "../handlers";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SlikRoutesConfig {
  store: Store;
  connection: Connection;
  /** Set to false to disable rate limiting. Default: true */
  rateLimit?: boolean;
}

// ---------------------------------------------------------------------------
// Rate-limit helpers
// ---------------------------------------------------------------------------

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

async function enforceRateLimitWithId(
  store: Store,
  identifier: string,
  routeKey: string
): Promise<Response | null> {
  const rule = DEFAULT_RATE_LIMITS[routeKey];
  if (!rule) return null;

  const result = await checkRateLimit(store, identifier, routeKey, rule);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfter: result.resetInSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.resetInSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // allowed
}

async function enforceRateLimit(
  store: Store,
  request: Request,
  routeKey: string
): Promise<Response | null> {
  const ip = getClientIp(request);
  return enforceRateLimitWithId(store, ip, routeKey);
}

// ---------------------------------------------------------------------------
// Next.js App Router adapter
//
// Returns { GET, POST } route handlers that can be re-exported from a
// Next.js catch-all route, e.g.:
//
//   // app/api/slik/[...path]/route.ts
//   import { createSlikRoutes } from "@slik-pay/server/nextjs";
//   export const { GET, POST } = createSlikRoutes({ store, connection });
// ---------------------------------------------------------------------------

export function createSlikRoutes(config: SlikRoutesConfig) {
  const ctx: handlers.HandlerContext = {
    store: config.store,
    connection: config.connection,
  };

  const rateLimitEnabled = config.rateLimit !== false;

  return {
    async GET(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        // GET /codes/:code/resolve
        const codeMatch = path.match(/\/codes\/(\d{6})\/resolve$/);
        if (codeMatch) {
          if (rateLimitEnabled) {
            const ip = getClientIp(request);

            // Check if IP is locked out from too many failed attempts
            const lockoutKey = `lockout:resolve:${ip}`;
            const isLocked = await config.store.get<boolean>(lockoutKey);
            if (isLocked) {
              return new Response(
                JSON.stringify({
                  error: "Too many failed attempts. Try again later.",
                  retryAfter: 300,
                }),
                {
                  status: 429,
                  headers: {
                    "Content-Type": "application/json",
                    "Retry-After": "300",
                  },
                }
              );
            }

            // Per-IP normal limit
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "codes/resolve"
            );
            if (blocked) return blocked;

            // Per-IP burst limit
            const burstBlocked = await enforceRateLimit(
              config.store,
              request,
              "codes/resolve:burst"
            );
            if (burstBlocked) return burstBlocked;

            // Global rate limit (prevents distributed brute-force across many IPs)
            const globalBlocked = await enforceRateLimitWithId(
              config.store,
              "global",
              "codes/resolve:global"
            );
            if (globalBlocked) return globalBlocked;
          }

          try {
            const result = await handlers.handleResolveCode(ctx, {
              code: codeMatch[1],
              wallet: url.searchParams.get("wallet") ?? undefined,
            });
            return Response.json(result);
          } catch (err) {
            if (err instanceof SlikError && err.statusCode === 404) {
              // Track failed resolve attempt for this IP
              if (rateLimitEnabled) {
                const ip = getClientIp(request);
                const failKey = `fail:resolve:${ip}`;
                const fails = await config.store.incr(failKey, 60);
                if (fails >= 20) {
                  // Lock out this IP for 5 minutes
                  await config.store.set(
                    `lockout:resolve:${ip}`,
                    true,
                    300
                  );
                }
              }
            }
            throw err; // re-throw to be caught by outer catch
          }
        }

        // GET /payments/:id/status
        const statusMatch = path.match(/\/payments\/([^/]+)\/status$/);
        if (statusMatch) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "payments/status"
            );
            if (blocked) return blocked;
          }
          const result = await handlers.handlePaymentStatus(ctx, {
            paymentId: statusMatch[1],
          });
          return Response.json(result);
        }

        // GET /price
        if (path.endsWith("/price")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "price"
            );
            if (blocked) return blocked;
          }
          const { getSolPrice } = await import("../price");
          const currency = url.searchParams.get("currency");
          if (currency) {
            const price = await getSolPrice(
              currency as "USD" | "PLN" | "EUR"
            );
            return Response.json({ price, currency });
          }
          // No currency param -> return all prices
          const prices = await getSolPrice();
          return Response.json({ prices });
        }

        // Solana Pay label (GET /pay)
        if (path.endsWith("/pay")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "pay"
            );
            if (blocked) return blocked;
          }
          return Response.json({ label: "SLIK", icon: "/icon.png" });
        }

        return Response.json({ error: "Not found" }, { status: 404 });
      } catch (err) {
        if (err instanceof SlikError) {
          return Response.json(
            { error: err.message },
            { status: err.statusCode }
          );
        }
        console.error("[slik]", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },

    async POST(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        const body = await request.json();

        // POST /codes/generate
        if (path.endsWith("/codes/generate")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "codes/generate"
            );
            if (blocked) return blocked;
          }
          const result = await handlers.handleGenerateCode(ctx, body);
          return Response.json(result);
        }

        // POST /payments/create
        if (path.endsWith("/payments/create")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "payments/create"
            );
            if (blocked) return blocked;
          }
          const result = await handlers.handleCreatePayment(ctx, body);
          return Response.json(result);
        }

        // POST /payments/link
        if (path.endsWith("/payments/link")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "payments/link"
            );
            if (blocked) return blocked;
          }
          const result = await handlers.handleLinkPayment(ctx, body);
          return Response.json(result);
        }

        // POST /pay
        if (path.endsWith("/pay")) {
          if (rateLimitEnabled) {
            const blocked = await enforceRateLimit(
              config.store,
              request,
              "pay"
            );
            if (blocked) return blocked;
          }
          const paymentId =
            url.searchParams.get("paymentId") || body.paymentId;
          const result = await handlers.handlePay(ctx, {
            paymentId,
            account: body.account,
          });
          return Response.json(result);
        }

        return Response.json({ error: "Not found" }, { status: 404 });
      } catch (err) {
        if (err instanceof SlikError) {
          return Response.json(
            { error: err.message },
            { status: err.statusCode }
          );
        }
        console.error("[slik]", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
  };
}
