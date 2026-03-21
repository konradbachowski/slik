import type { Connection } from "@solana/web3.js";
import type { Store } from "../storage";
import * as handlers from "../handlers";
import { BlikError } from "../handlers";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface BlikRoutesConfig {
  store: Store;
  connection: Connection;
}

// ---------------------------------------------------------------------------
// Next.js App Router adapter
//
// Returns { GET, POST } route handlers that can be re-exported from a
// Next.js catch-all route, e.g.:
//
//   // app/api/blik/[...path]/route.ts
//   import { createBlikRoutes } from "@solana-blik/server/nextjs";
//   export const { GET, POST } = createBlikRoutes({ store, connection });
// ---------------------------------------------------------------------------

export function createBlikRoutes(config: BlikRoutesConfig) {
  const ctx: handlers.HandlerContext = {
    store: config.store,
    connection: config.connection,
  };

  return {
    async GET(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        // GET /codes/:code/resolve
        const codeMatch = path.match(/\/codes\/(\d{6})\/resolve$/);
        if (codeMatch) {
          const result = await handlers.handleResolveCode(ctx, {
            code: codeMatch[1],
          });
          return Response.json(result);
        }

        // GET /payments/:id/status
        const statusMatch = path.match(/\/payments\/([^/]+)\/status$/);
        if (statusMatch) {
          const result = await handlers.handlePaymentStatus(ctx, {
            paymentId: statusMatch[1],
          });
          return Response.json(result);
        }

        // GET /price
        if (path.endsWith("/price")) {
          const { getSolPrice } = await import("../price");
          const currency = url.searchParams.get("currency");
          if (currency) {
            const price = await getSolPrice(
              currency as "USD" | "PLN" | "EUR"
            );
            return Response.json({ price, currency });
          }
          // No currency param → return all prices
          const prices = await getSolPrice();
          return Response.json({ prices });
        }

        // Solana Pay label (GET /pay)
        if (path.endsWith("/pay")) {
          return Response.json({ label: "SolanaBLIK", icon: "/icon.png" });
        }

        return Response.json({ error: "Not found" }, { status: 404 });
      } catch (err) {
        if (err instanceof BlikError) {
          return Response.json(
            { error: err.message },
            { status: err.statusCode }
          );
        }
        console.error("[solana-blik]", err);
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
          const result = await handlers.handleGenerateCode(ctx, body);
          return Response.json(result);
        }

        // POST /payments/create
        if (path.endsWith("/payments/create")) {
          const result = await handlers.handleCreatePayment(ctx, body);
          return Response.json(result);
        }

        // POST /payments/link
        if (path.endsWith("/payments/link")) {
          const result = await handlers.handleLinkPayment(ctx, body);
          return Response.json(result);
        }

        // POST /pay
        if (path.endsWith("/pay")) {
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
        if (err instanceof BlikError) {
          return Response.json(
            { error: err.message },
            { status: err.statusCode }
          );
        }
        console.error("[solana-blik]", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    },
  };
}
