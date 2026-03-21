"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Connection, PublicKey } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { watchReceipt } from "../receipt";

type PayStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "paid"
  | "error";

export interface UseSlikPayReturn {
  status: PayStatus;
  error: string | null;
  pay: (opts: {
    paymentId: string;
    apiBaseUrl: string;
    customerPubkey: PublicKey;
    connection: Connection;
    sendTransaction: (
      tx: Transaction,
      connection: Connection
    ) => Promise<string>;
  }) => Promise<void>;
  reset: () => void;
}

/** Portable base64 decode that works in browsers without Buffer polyfill. */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function useSlikPay(): UseSlikPayReturn {
  const [status, setStatus] = useState<PayStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<PayStatus>("idle");
  const unsubRef = useRef<(() => void) | null>(null);

  // Keep statusRef in sync with state
  statusRef.current = status;

  // Clean up watchReceipt subscription on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  const pay = useCallback(
    async (opts: {
      paymentId: string;
      apiBaseUrl: string;
      customerPubkey: PublicKey;
      connection: Connection;
      sendTransaction: (
        tx: Transaction,
        connection: Connection
      ) => Promise<string>;
    }) => {
      const {
        paymentId,
        apiBaseUrl,
        customerPubkey,
        connection,
        sendTransaction,
      } = opts;

      // Clean up any previous subscription
      unsubRef.current?.();
      unsubRef.current = null;

      setError(null);
      setStatus("building");

      try {
        const res = await fetch(`${apiBaseUrl}/pay?paymentId=${paymentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: customerPubkey.toBase58() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ||
              "Failed to create transaction"
          );
        }
        const data = (await res.json()) as { transaction: string };
        const txBytes = base64ToUint8Array(data.transaction);
        const transaction = Transaction.from(txBytes);

        setStatus("signing");
        await sendTransaction(transaction, connection);

        setStatus("confirming");
        await new Promise<void>((resolve, reject) => {
          const unsub = watchReceipt(connection, paymentId, {
            onConfirmed: () => {
              unsubRef.current = null;
              setStatus("paid");
              resolve();
            },
            onError: (err) => {
              unsubRef.current = null;
              setError(err.message);
              setStatus("error");
              reject(err);
            },
            timeoutMs: 120_000,
          });
          unsubRef.current = unsub;
        });
      } catch (err) {
        if (statusRef.current !== "paid") {
          setError(
            err instanceof Error ? err.message : "Payment failed"
          );
          setStatus("error");
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, pay, reset };
}
