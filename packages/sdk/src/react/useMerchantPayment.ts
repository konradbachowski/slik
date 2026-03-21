"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Connection } from "@solana/web3.js";
import { deriveReceiptPda } from "../pda";
import { useSlikContextOptional } from "./SlikProvider";

type MerchantStatus =
  | "idle"
  | "awaiting_code"
  | "linked"
  | "confirming"
  | "paid"
  | "expired"
  | "error";

export interface UseMerchantPaymentReturn {
  status: MerchantStatus;
  paymentId: string | null;
  amount: number | null;
  error: string | null;
  createPayment: (amount: number, merchantWallet: string, currency?: "SOL" | "USDC") => Promise<void>;
  linkCode: (code: string) => Promise<void>;
  reset: () => void;
}

export function useMerchantPayment(opts: {
  apiBaseUrl?: string;
  connection: Connection;
}): UseMerchantPaymentReturn {
  const ctx = useSlikContextOptional();
  const apiBaseUrl = opts.apiBaseUrl ?? ctx?.apiBaseUrl;
  if (!apiBaseUrl) {
    throw new Error(
      "apiBaseUrl is required - pass it as a prop or wrap with <SlikProvider>"
    );
  }

  const { connection } = opts;
  const [status, setStatus] = useState<MerchantStatus>("idle");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const createPayment = useCallback(
    async (amt: number, merchantWallet: string, currency?: "SOL" | "USDC") => {
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/payments/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, merchantWallet, ...(currency && { currency }) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Failed to create payment"
          );
        }
        const data = (await res.json()) as { paymentId: string };
        setPaymentId(data.paymentId);
        setAmount(amt);
        setStatus("awaiting_code");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create payment"
        );
        setStatus("error");
      }
    },
    [apiBaseUrl]
  );

  const linkCode = useCallback(
    async (code: string) => {
      if (!paymentId) return;
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/payments/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, code }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Code not found or expired"
          );
        }
        setStatus("confirming");

        // Start watching receipt PDA
        const [receiptPda] = deriveReceiptPda(paymentId);

        const subId = connection.onAccountChange(
          receiptPda,
          (accountInfo) => {
            if (accountInfo.data.length > 0) {
              cleanup();
              setStatus("paid");
            }
          },
          "confirmed"
        );

        // Fallback poll
        let attempts = 0;
        const fallbackInterval = setInterval(async () => {
          attempts++;
          if (attempts > 100) {
            cleanup();
            setStatus("expired");
            setError("Payment timed out");
            return;
          }
          try {
            const statusRes = await fetch(
              `${apiBaseUrl}/payments/${paymentId}/status`
            );
            if (!statusRes.ok) return;
            const statusData = (await statusRes.json()) as {
              status: string;
            };
            if (statusData.status === "paid") {
              cleanup();
              setStatus("paid");
            } else if (statusData.status === "expired") {
              cleanup();
              setStatus("expired");
              setError("Payment expired");
            }
          } catch {
            /* retry */
          }
        }, 3000);

        // S6: Guard against double cleanup
        let cleaned = false;
        function cleanup() {
          if (cleaned) return;
          cleaned = true;
          connection.removeAccountChangeListener(subId);
          clearInterval(fallbackInterval);
          cleanupRef.current = null;
        }

        cleanupRef.current = cleanup;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to link code"
        );
        setStatus("error");
      }
    },
    [paymentId, apiBaseUrl, connection]
  );

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setStatus("idle");
    setPaymentId(null);
    setAmount(null);
    setError(null);
  }, []);

  return { status, paymentId, amount, error, createPayment, linkCode, reset };
}
