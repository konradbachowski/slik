"use client";

import { useState, useCallback } from "react";
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

interface UseBlikPayReturn {
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

export function useBlikPay(): UseBlikPayReturn {
  const [status, setStatus] = useState<PayStatus>("idle");
  const [error, setError] = useState<string | null>(null);

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
        const txBuffer = Buffer.from(data.transaction, "base64");
        const transaction = Transaction.from(txBuffer);

        setStatus("signing");
        await sendTransaction(transaction, connection);

        setStatus("confirming");
        await new Promise<void>((resolve, reject) => {
          watchReceipt(connection, paymentId, {
            onConfirmed: () => {
              setStatus("paid");
              resolve();
            },
            onError: (err) => {
              setError(err.message);
              setStatus("error");
              reject(err);
            },
            timeoutMs: 120_000,
          });
        });
      } catch (err) {
        if (status !== "paid") {
          setError(
            err instanceof Error ? err.message : "Payment failed"
          );
          setStatus("error");
        }
      }
    },
    [status]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, pay, reset };
}
