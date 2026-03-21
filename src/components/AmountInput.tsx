"use client";

import { useState, useCallback, useEffect } from "react";

type FiatCurrency = "PLN" | "USD" | "EUR";
type PayCurrency = "SOL" | "USDC";

const FIAT_CURRENCIES: { code: FiatCurrency; symbol: string }[] = [
  { code: "PLN", symbol: "zl" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "E" },
];

interface AmountInputProps {
  onSubmit: (amount: number, fiatLabel?: string, currency?: PayCurrency) => void;
}

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "del"],
] as const;

export default function AmountInput({ onSubmit }: AmountInputProps) {
  const [value, setValue] = useState("0");
  const [pressing, setPressing] = useState<string | null>(null);
  const [payCurrency, setPayCurrency] = useState<PayCurrency>("SOL");
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>("PLN");
  const [prices, setPrices] = useState<Record<FiatCurrency, number> | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Fetch SOL prices on mount
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/price");
        if (res.ok) {
          const data = await res.json();
          setPrices(data.prices);
        }
      } catch {
        // Will use fallback
      } finally {
        setPriceLoading(false);
      }
    }
    fetchPrices();
    // Refresh every 60s
    const interval = setInterval(fetchPrices, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleKey = useCallback((key: string) => {
    setPressing(key);
    setTimeout(() => setPressing(null), 120);

    setValue((prev) => {
      if (key === "del") {
        if (prev.length <= 1) return "0";
        return prev.slice(0, -1);
      }

      if (key === ".") {
        if (prev.includes(".")) return prev;
        return prev + ".";
      }

      // Enforce max 2 decimal places
      const dotIndex = prev.indexOf(".");
      if (dotIndex !== -1 && prev.length - dotIndex > 2) {
        return prev;
      }

      // Prevent leading zeros (except "0.")
      if (prev === "0" && key !== ".") {
        return key;
      }

      // Cap at reasonable length
      if (prev.replace(".", "").length >= 8) return prev;

      return prev + key;
    });
  }, []);

  const numericValue = parseFloat(value);
  const isUsdc = payCurrency === "USDC";

  // For USDC: amount is directly in USD (no conversion needed)
  // For SOL: amount is fiat, needs conversion
  const isValid = !isNaN(numericValue) && numericValue > 0 && (isUsdc || prices !== null);

  const solAmount =
    !isUsdc && isValid && prices ? numericValue / prices[fiatCurrency] : 0;

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    if (isUsdc) {
      // USDC: amount is directly in USDC
      onSubmit(numericValue, `${numericValue.toFixed(2)} USDC`, "USDC");
    } else if (solAmount > 0) {
      const label = `${parseFloat(value).toFixed(2)} ${fiatCurrency}`;
      onSubmit(solAmount, label, "SOL");
    }
  }, [isValid, isUsdc, numericValue, solAmount, onSubmit, value, fiatCurrency]);

  // Format display
  const displayValue = value.endsWith(".") ? value + "00" : value;

  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ animation: "fade-in-up 0.4s ease-out both" }}
    >
      {/* SOL / USDC pill toggle */}
      <div
        style={{
          display: "inline-flex",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 100,
          padding: 3,
          marginBottom: 12,
          position: "relative",
        }}
      >
        {/* Sliding indicator */}
        <div
          style={{
            position: "absolute",
            top: 3,
            left: isUsdc ? "50%" : 3,
            width: "calc(50% - 3px)",
            height: "calc(100% - 6px)",
            borderRadius: 100,
            background: isUsdc ? "#2775ca" : "var(--primary)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {(["SOL", "USDC"] as PayCurrency[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setPayCurrency(c); setValue("0"); }}
            style={{
              position: "relative",
              zIndex: 1,
              fontFamily: "var(--font-code)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "8px 24px",
              borderRadius: 100,
              border: "none",
              background: "transparent",
              color: payCurrency === c ? "#ffffff" : "var(--text-muted)",
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Fiat currency selector (only for SOL mode) */}
      {!isUsdc && (
        <div className="flex gap-2 mb-4">
          {FIAT_CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setFiatCurrency(c.code)}
              className="px-4 py-2 text-sm font-medium cursor-pointer select-none"
              style={{
                fontFamily: "var(--font-code)",
                borderRadius: "var(--radius-btn)",
                backgroundColor:
                  fiatCurrency === c.code ? "var(--primary)" : "var(--bg-card)",
                color: fiatCurrency === c.code ? "#ffffff" : "var(--text-secondary)",
                border:
                  fiatCurrency === c.code
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                transition: "all 0.15s ease",
              }}
            >
              {c.code}
            </button>
          ))}
        </div>
      )}

      {/* Amount display */}
      <div
        className="w-full rounded-2xl mb-4 px-5 py-7"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div className="flex items-baseline justify-end gap-3">
          <span
            className="text-5xl font-bold tracking-tight tabular-nums leading-none"
            style={{
              fontFamily: "var(--font-code)",
              color: value === "0" ? "var(--text-muted)" : "var(--text)",
              transition: "color 0.2s ease",
            }}
          >
            {displayValue}
          </span>
          <span
            className="text-lg font-semibold tracking-wider uppercase"
            style={{
              fontFamily: "var(--font-code)",
              color: isUsdc ? "#2775ca" : "var(--primary)",
              opacity: 0.65,
            }}
          >
            {isUsdc ? "USDC" : fiatCurrency}
          </span>
        </div>

        {/* SOL conversion */}
        <div
          className="mt-3 flex items-center justify-end gap-2"
          style={{ minHeight: 24 }}
        >
          {isUsdc ? (
            numericValue > 0 ? (
              <span
                className="text-sm font-medium"
                style={{ color: "#2775ca", fontFamily: "var(--font-code)" }}
              >
                Stablecoin - no price conversion needed
              </span>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-code)" }}
              >
                Enter amount in USDC
              </span>
            )
          ) : priceLoading ? (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-code)" }}
            >
              Loading price...
            </span>
          ) : solAmount > 0 ? (
            <>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-code)" }}
              >
                = {solAmount.toFixed(6)} SOL
              </span>
              {prices && (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)", fontFamily: "var(--font-code)" }}
                >
                  (1 SOL = {prices[fiatCurrency].toFixed(2)} {fiatCurrency})
                </span>
              )}
            </>
          ) : (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-code)" }}
            >
              Enter amount to see SOL conversion
            </span>
          )}
        </div>

        {/* Accent underline */}
        <div
          className="mt-4 h-px w-full rounded-full"
          style={{
            background: isValid
              ? "linear-gradient(90deg, transparent, var(--primary), transparent)"
              : "linear-gradient(90deg, transparent, var(--border), transparent)",
            transition: "background 0.3s ease",
          }}
        />
      </div>

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[320px]">
        {NUMPAD_KEYS.flat().map((key) => {
          const isDelete = key === "del";
          const isPressed = pressing === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              className="relative flex items-center justify-center h-14 select-none cursor-pointer overflow-hidden"
              style={{
                backgroundColor: isPressed
                  ? "var(--bg-card-hover)"
                  : "var(--bg-card)",
                borderRadius: "var(--radius-btn)",
                border: "1px solid var(--border)",
                transform: isPressed ? "scale(0.93)" : "scale(1)",
                transition: "transform 0.1s ease, background-color 0.1s ease",
              }}
              aria-label={
                isDelete
                  ? "Delete"
                  : key === "."
                    ? "Decimal point"
                    : `Digit ${key}`
              }
            >
              {isDelete ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-secondary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              ) : (
                <span
                  className="text-xl font-medium"
                  style={{
                    fontFamily: "var(--font-code)",
                    color: "var(--text)",
                  }}
                >
                  {key}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full max-w-[320px] mt-5 h-14 font-semibold text-base tracking-wide uppercase cursor-pointer select-none"
        style={{
          fontFamily: "var(--font-code)",
          borderRadius: "var(--radius-btn)",
          backgroundColor: isValid ? "var(--primary)" : "var(--bg-card)",
          color: isValid ? "#ffffff" : "var(--text-muted)",
          border: isValid ? "none" : "1px solid var(--border)",
          opacity: isValid ? 1 : 0.5,
          transition: "all 0.2s ease",
          letterSpacing: "0.08em",
        }}
        aria-label="Create payment"
      >
        Create payment
      </button>
    </div>
  );
}
