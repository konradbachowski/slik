"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useBlikContextOptional } from "./BlikProvider";

type CodeStatus = "idle" | "generating" | "active" | "linked" | "expired";

interface LinkedPayment {
  paymentId: string;
  amount: number;
  reference?: string;
}

export interface UsePaymentCodeReturn {
  code: string | null;
  expiresAt: number;
  status: CodeStatus;
  linkedPayment: LinkedPayment | null;
  error: string | null;
  generate: (walletPubkey: string) => Promise<void>;
  reset: () => void;
}

export function usePaymentCode(opts?: {
  apiBaseUrl?: string;
}): UsePaymentCodeReturn {
  const ctx = useBlikContextOptional();
  const apiBaseUrl = opts?.apiBaseUrl ?? ctx?.apiBaseUrl;
  if (!apiBaseUrl) {
    throw new Error(
      "apiBaseUrl is required - pass it as a prop or wrap with <BlikProvider>"
    );
  }

  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [linkedPayment, setLinkedPayment] = useState<LinkedPayment | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const generate = useCallback(
    async (walletPubkey: string) => {
      setStatus("generating");
      setError(null);
      stopPolling();

      try {
        const res = await fetch(`${apiBaseUrl}/codes/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletPubkey }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Failed to generate code"
          );
        }

        const data = (await res.json()) as {
          code: string;
          expiresIn?: number;
        };
        const newCode = data.code;
        const ttl = data.expiresIn || 120;
        const deadline = Date.now() + ttl * 1000;

        setCode(newCode);
        setExpiresAt(deadline);
        expiresAtRef.current = deadline;
        setStatus("active");

        // Poll for code resolution
        pollRef.current = setInterval(async () => {
          // S5: Stop polling after code TTL expires
          if (Date.now() > expiresAtRef.current) {
            stopPolling();
            setStatus("expired");
            return;
          }

          try {
            const resolveRes = await fetch(
              `${apiBaseUrl}/codes/${newCode}/resolve?wallet=${encodeURIComponent(walletPubkey)}`
            );
            if (!resolveRes.ok) {
              if (resolveRes.status === 404) {
                stopPolling();
                setStatus("expired");
              }
              return;
            }
            const resolveData = (await resolveRes.json()) as {
              status: string;
              paymentId: string;
              amount: number;
              reference?: string;
            };
            if (
              resolveData.status === "linked" ||
              resolveData.status === "paid"
            ) {
              stopPolling();
              setLinkedPayment({
                paymentId: resolveData.paymentId,
                amount: resolveData.amount,
                reference: resolveData.reference,
              });
              setStatus("linked");
            }
          } catch {
            // Retry silently
          }
        }, 1000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setStatus("idle");
      }
    },
    [apiBaseUrl, stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setCode(null);
    setExpiresAt(0);
    expiresAtRef.current = 0;
    setStatus("idle");
    setLinkedPayment(null);
    setError(null);
  }, [stopPolling]);

  return { code, expiresAt, status, linkedPayment, error, generate, reset };
}
