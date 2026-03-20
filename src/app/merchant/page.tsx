"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import AmountInput from "@/components/AmountInput";
import CodeInput from "@/components/CodeInput";
import { WalletButton } from "@/components/WalletButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalState =
  | { step: "amount" }
  | { step: "code"; paymentId: string; amount: number; fiatLabel?: string }
  | { step: "waiting"; paymentId: string; amount: number; code: string; fiatLabel?: string }
  | { step: "success"; amount: number; fiatLabel?: string }
  | { step: "error"; message: string; paymentId?: string; amount?: number };

type StatusColor = "green" | "yellow" | "red" | "idle";

// ---------------------------------------------------------------------------
// Merchant terminal
// ---------------------------------------------------------------------------

export default function MerchantTerminal() {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<TerminalState>({ step: "amount" });
  const [transitioning, setTransitioning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ----------------------------------
  // Animated state transition
  // ----------------------------------
  const transitionTo = useCallback((next: TerminalState) => {
    setTransitioning(true);
    setTimeout(() => {
      setState(next);
      setTransitioning(false);
    }, 180);
  }, []);

  // ----------------------------------
  // Step 1 - create payment
  // ----------------------------------
  const handleAmountSubmit = useCallback(
    async (amount: number, fiatLabel?: string) => {
      if (!publicKey) return;

      try {
        const res = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, merchantWallet: publicKey.toBase58() }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || "Failed to create payment"
          );
        }

        const data = await res.json();
        transitionTo({
          step: "code",
          paymentId: data.paymentId,
          amount,
          fiatLabel,
        });
      } catch (err) {
        transitionTo({
          step: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to create payment",
        });
      }
    },
    [transitionTo, publicKey]
  );

  // ----------------------------------
  // Step 2 - link code
  // ----------------------------------
  const handleCodeComplete = useCallback(
    async (code: string) => {
      if (state.step !== "code") return;

      const { paymentId, amount } = state;

      try {
        const res = await fetch("/api/payments/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, code }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || "Code not found or expired"
          );
        }

        transitionTo({
          step: "waiting",
          paymentId,
          amount,
          code,
          fiatLabel: state.step === "code" ? state.fiatLabel : undefined,
        });
      } catch (err) {
        transitionTo({
          step: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to link code",
          paymentId,
          amount,
        });
      }
    },
    [state, transitionTo]
  );

  // ----------------------------------
  // Step 3 - poll for confirmation
  // ----------------------------------
  useEffect(() => {
    if (state.step !== "waiting") return;

    const { paymentId, amount } = state;
    let attempts = 0;
    const maxAttempts = 600; // 5 min at 500 ms

    const interval = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        clearInterval(interval);
        transitionTo({
          step: "error",
          message:
            "Payment timed out. Customer did not approve in time.",
          paymentId,
          amount,
        });
        return;
      }

      try {
        const res = await fetch(
          `/api/payments/${paymentId}/status`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "paid") {
          clearInterval(interval);
          const fiat = state.step === "waiting" ? state.fiatLabel : undefined;
          transitionTo({ step: "success", amount, fiatLabel: fiat });
        } else if (data.status === "expired") {
          clearInterval(interval);
          transitionTo({
            step: "error",
            message: "Payment expired.",
            paymentId,
            amount,
          });
        }
      } catch {
        // Network hiccup - silently retry
      }
    }, 500);

    pollRef.current = interval;

    return () => {
      clearInterval(interval);
      pollRef.current = null;
    };
  }, [state, transitionTo]);

  // ----------------------------------
  // Reset
  // ----------------------------------
  const handleReset = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    transitionTo({ step: "amount" });
  }, [transitionTo]);

  // ----------------------------------
  // Status bar
  // ----------------------------------
  const statusInfo = getStatusInfo(state);

  return (
    <div
      className="relative z-10 flex flex-col min-h-dvh w-full items-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Header bar */}
      <header
        className="w-full max-w-[420px] flex items-center justify-between px-5 pt-6 pb-3"
        style={{ animation: "fade-in-up 0.3s ease-out both" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), #8b85ff)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{
              fontFamily: "var(--font-code)",
              color: "var(--text-secondary)",
              letterSpacing: "0.12em",
            }}
          >
            SolanaBLIK
          </span>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: STATUS_COLORS[statusInfo.color],
              animation:
                statusInfo.color !== "idle"
                  ? "status-blink 1.5s ease-in-out infinite"
                  : "none",
            }}
          />
          <span
            className="text-xs tracking-wide"
            style={{
              fontFamily: "var(--font-code)",
              color: "var(--text-muted)",
            }}
          >
            {statusInfo.label}
          </span>
        </div>
      </header>

      {/* Top divider */}
      <div
        className="w-full max-w-[420px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--border), transparent)",
        }}
      />

      {/* Main content area */}
      <main
        className="flex-1 flex flex-col items-center justify-center w-full max-w-[420px] px-5 py-8"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning
            ? "translateY(-8px)"
            : "translateY(0)",
          transition:
            "opacity 0.16s ease, transform 0.16s ease",
        }}
      >
        {state.step === "amount" && !connected && (
          <div
            className="flex flex-col items-center gap-6 w-full"
            style={{ animation: "fade-in-up 0.35s ease-out both" }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                background: "rgba(99, 91, 255, 0.06)",
                border: "1px solid rgba(99, 91, 255, 0.15)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M21 12V7H5a2 2 0 010-4h14v4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 5v14a2 2 0 002 2h16v-5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 12a1 1 0 100 4h4v-4h-4z" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text)", fontFamily: "var(--font-code)" }}
              >
                Connect your wallet to receive payments
              </p>
              <p
                className="text-xs text-center"
                style={{ color: "var(--text-muted)", maxWidth: 280 }}
              >
                Your wallet address will be used as the destination for customer payments.
              </p>
            </div>
            <WalletButton />
          </div>
        )}

        {state.step === "amount" && connected && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-code)",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--green)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </span>
            </div>
            <AmountInput onSubmit={handleAmountSubmit} />
          </div>
        )}

        {state.step === "code" && (
          <CodeStep
            amount={state.amount}
            fiatLabel={state.fiatLabel}
            onCodeComplete={handleCodeComplete}
            onCancel={handleReset}
          />
        )}

        {state.step === "waiting" && (
          <WaitingStep amount={state.amount} code={state.code} fiatLabel={state.fiatLabel} />
        )}

        {state.step === "success" && (
          <SuccessStep
            amount={state.amount}
            fiatLabel={state.fiatLabel}
            onReset={handleReset}
          />
        )}

        {state.step === "error" && (
          <ErrorStep
            message={state.message}
            onRetry={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[420px] px-5 pb-6 pt-2">
        <div
          className="h-px w-full mb-3"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--border), transparent)",
          }}
        />
        <p
          className="text-center text-xs"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--text-muted)",
          }}
        >
          Merchant terminal v0.1
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CodeStep({
  amount,
  fiatLabel,
  onCodeComplete,
  onCancel,
}: {
  amount: number;
  fiatLabel?: string;
  onCodeComplete: (code: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center w-full gap-8"
      style={{ animation: "fade-in-up 0.35s ease-out both" }}
    >
      {/* Amount badge */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--text-muted)",
          }}
        >
          Payment amount
        </span>
        {fiatLabel && (
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-code)", color: "var(--text)" }}
          >
            {fiatLabel}
          </span>
        )}
        <span
          className={fiatLabel ? "text-sm" : "text-3xl font-bold"}
          style={{
            fontFamily: "var(--font-code)",
            color: fiatLabel ? "var(--text-secondary)" : "var(--text)",
          }}
        >
          {formatAmount(amount)}
          <span
            className="text-sm font-semibold ml-2"
            style={{ color: "var(--primary)", opacity: 0.7 }}
          >
            SOL
          </span>
        </span>
      </div>

      {/* OTP input */}
      <CodeInput onComplete={onCodeComplete} />

      {/* Cancel link */}
      <button
        type="button"
        onClick={onCancel}
        className="text-sm tracking-wide cursor-pointer bg-transparent border-none"
        style={{
          fontFamily: "var(--font-code)",
          color: "var(--text-muted)",
          opacity: 0.6,
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.6";
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function WaitingStep({
  amount,
  code,
  fiatLabel,
}: {
  amount: number;
  code: string;
  fiatLabel?: string;
}) {
  return (
    <div
      className="flex flex-col items-center w-full gap-8"
      style={{ animation: "fade-in-up 0.35s ease-out both" }}
    >
      {/* Amount */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--text-muted)",
          }}
        >
          Awaiting approval
        </span>
        {fiatLabel && (
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-code)", color: "var(--text)" }}
          >
            {fiatLabel}
          </span>
        )}
        <span
          className={fiatLabel ? "text-sm" : "text-3xl font-bold"}
          style={{
            fontFamily: "var(--font-code)",
            color: fiatLabel ? "var(--text-secondary)" : "var(--text)",
          }}
        >
          {formatAmount(amount)}
          <span
            className="text-sm font-semibold ml-2"
            style={{ color: "var(--primary)", opacity: 0.7 }}
          >
            SOL
          </span>
        </span>
      </div>

      {/* Locked code display */}
      <div className="flex gap-2.5 justify-center">
        {code.split("").map((digit, i) => (
          <div
            key={i}
            className="w-12 h-16 flex items-center justify-center text-2xl font-bold"
            style={{
              fontFamily: "var(--font-code)",
              borderRadius: "var(--radius-digit)",
              backgroundColor: "var(--bg-card)",
              color: "var(--primary)",
              border: "2px solid var(--primary)",
              opacity: 0.55,
            }}
          >
            {digit}
          </div>
        ))}
      </div>

      {/* Pulsing dots */}
      <div className="flex items-center gap-3 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: "var(--warning)",
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <p
        className="text-sm text-center leading-relaxed"
        style={{
          fontFamily: "var(--font-code)",
          color: "var(--text-secondary)",
        }}
      >
        Waiting for the customer to confirm
        <br />
        payment in their wallet...
      </p>
    </div>
  );
}

function SuccessStep({
  amount,
  fiatLabel,
  onReset,
}: {
  amount: number;
  fiatLabel?: string;
  onReset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center w-full gap-6"
      style={{ animation: "fade-in-up 0.4s ease-out both" }}
    >
      {/* Checkmark with ripple */}
      <div className="relative flex items-center justify-center">
        {/* Ripple rings */}
        <div
          className="absolute w-20 h-20 rounded-full"
          style={{
            border: "2px solid var(--green)",
            animation: "ripple-expand 1.5s ease-out 0.3s forwards",
            opacity: 0,
          }}
        />
        <div
          className="absolute w-20 h-20 rounded-full"
          style={{
            border: "2px solid var(--green)",
            animation: "ripple-expand 1.5s ease-out 0.6s forwards",
            opacity: 0,
          }}
        />

        {/* Green circle */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--green), #28a058)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
          >
            <path
              d="M10 20L17 27L30 13"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="48"
              strokeDashoffset="48"
              style={{
                animation:
                  "draw-check 0.5s ease-out 0.3s forwards",
              }}
            />
          </svg>
        </div>
      </div>

      {/* Confirmation text */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--green)",
          }}
        >
          Payment confirmed
        </span>
        {fiatLabel && (
          <span
            className="text-4xl font-bold"
            style={{ fontFamily: "var(--font-code)", color: "var(--text)" }}
          >
            {fiatLabel}
          </span>
        )}
        <span
          className={fiatLabel ? "text-base" : "text-4xl font-bold"}
          style={{
            fontFamily: "var(--font-code)",
            color: fiatLabel ? "var(--text-secondary)" : "var(--text)",
          }}
        >
          {formatAmount(amount)}
          <span
            className="text-base font-semibold ml-2"
            style={{ color: "var(--primary)", opacity: 0.7 }}
          >
            SOL
          </span>
        </span>
      </div>

      {/* New payment */}
      <button
        type="button"
        onClick={onReset}
        className="w-full max-w-[320px] mt-4 h-14 font-semibold text-base tracking-wide uppercase cursor-pointer select-none"
        style={{
          fontFamily: "var(--font-code)",
          borderRadius: "var(--radius-btn)",
          backgroundColor: "var(--bg-card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          transition: "background-color var(--transition)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--bg-card-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--bg-card)";
        }}
      >
        New payment
      </button>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center w-full gap-6"
      style={{ animation: "fade-in-up 0.35s ease-out both" }}
    >
      {/* Error icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "rgba(223, 27, 65, 0.06)",
          border: "2px solid var(--error)",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
            stroke="var(--error)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="var(--error)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Error text */}
      <div className="flex flex-col items-center gap-2">
        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--error)",
          }}
        >
          Error
        </span>
        <p
          className="text-sm text-center leading-relaxed max-w-[280px]"
          style={{
            fontFamily: "var(--font-code)",
            color: "var(--text-secondary)",
          }}
        >
          {message}
        </p>
      </div>

      {/* Retry */}
      <button
        type="button"
        onClick={onRetry}
        className="w-full max-w-[320px] mt-2 h-14 font-semibold text-base tracking-wide uppercase cursor-pointer select-none"
        style={{
          fontFamily: "var(--font-code)",
          borderRadius: "var(--radius-btn)",
          backgroundColor: "var(--bg-card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          transition: "background-color var(--transition)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--bg-card-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--bg-card)";
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<StatusColor, string> = {
  green: "#30b566",
  yellow: "#e5960a",
  red: "#df1b41",
  idle: "#a3acb9",
};

function getStatusInfo(state: TerminalState): {
  label: string;
  color: StatusColor;
} {
  switch (state.step) {
    case "amount":
      return { label: "Ready", color: "green" };
    case "code":
      return { label: "Awaiting code", color: "yellow" };
    case "waiting":
      return { label: "Processing", color: "yellow" };
    case "success":
      return { label: "Confirmed", color: "green" };
    case "error":
      return { label: "Error", color: "red" };
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
