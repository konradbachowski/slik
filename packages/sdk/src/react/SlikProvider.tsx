"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";

export interface SlikContextValue {
  apiBaseUrl: string;
  programId?: PublicKey;
}

const SlikContext = createContext<SlikContextValue | null>(null);

export function SlikProvider({
  children,
  apiBaseUrl,
  programId,
}: {
  children: ReactNode;
  apiBaseUrl: string;
  programId?: PublicKey;
}) {
  return (
    <SlikContext.Provider value={{ apiBaseUrl, programId }}>
      {children}
    </SlikContext.Provider>
  );
}

export function useSlikContext(): SlikContextValue {
  const ctx = useContext(SlikContext);
  if (!ctx)
    throw new Error("useSlikContext must be used within <SlikProvider>");
  return ctx;
}

/**
 * Optional variant - returns null if no provider is present.
 * Used internally by hooks to support both provider-based and prop-based usage.
 */
export function useSlikContextOptional(): SlikContextValue | null {
  return useContext(SlikContext);
}
