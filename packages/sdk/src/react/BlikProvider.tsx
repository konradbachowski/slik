"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";

export interface BlikContextValue {
  apiBaseUrl: string;
  programId?: PublicKey;
}

const BlikContext = createContext<BlikContextValue | null>(null);

export function BlikProvider({
  children,
  apiBaseUrl,
  programId,
}: {
  children: ReactNode;
  apiBaseUrl: string;
  programId?: PublicKey;
}) {
  return (
    <BlikContext.Provider value={{ apiBaseUrl, programId }}>
      {children}
    </BlikContext.Provider>
  );
}

export function useBlikContext(): BlikContextValue {
  const ctx = useContext(BlikContext);
  if (!ctx)
    throw new Error("useBlikContext must be used within <BlikProvider>");
  return ctx;
}

/**
 * Optional variant - returns null if no provider is present.
 * Used internally by hooks to support both provider-based and prop-based usage.
 */
export function useBlikContextOptional(): BlikContextValue | null {
  return useContext(BlikContext);
}
