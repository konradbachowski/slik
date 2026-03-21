"use client";

import { useState, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMerchantPayment } from "@slik-pay/sdk/react";
import AmountInput from "@/components/AmountInput";
import CodeInput from "@/components/CodeInput";
import { WalletButton } from "@/components/WalletButton";
import { Nav } from "@/components/Nav";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusColor = "green" | "yellow" | "red" | "idle";

// ---------------------------------------------------------------------------
// Merchant terminal
// ---------------------------------------------------------------------------

export default function MerchantTerminal() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const { status, amount, error, createPayment, linkCode, reset } =
    useMerchantPayment({ apiBaseUrl: "/api", connection });

  // Local state not tracked by the hook
  const [fiatLabel, setFiatLabel] = useState<string | undefined>();
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [transitioning, setTransitioning] = useState(false);
  const prevStatusRef = useRef(status);

  // ----------------------------------
  // Smooth transition wrapper
  // ----------------------------------
  const withTransition = useCallback((fn: () => void) => {
    setTransitioning(true);
    setTimeout(() => {
      fn();
      setTransitioning(false);
    }, 180);
  }, []);

  // Detect status changes from the hook and animate them
  if (prevStatusRef.current !== status) {
    prevStatusRef.current = status;
    if (!transitioning) {
      setTransitioning(true);
      setTimeout(() => setTransitioning(false), 180);
    }
  }

  // ----------------------------------
  // Handlers
  // ----------------------------------
  const handleAmountSubmit = useCallback(
    (amt: number, label?: string, currency?: "SOL" | "USDC") => {
      if (!publicKey) return;
      setFiatLabel(label);
      createPayment(amt, publicKey.toBase58(), currency);
    },
    [publicKey, createPayment]
  );

  const handleCodeComplete = useCallback(
    (code: string) => {
      setEnteredCode(code);
      linkCode(code);
    },
    [linkCode]
  );

  const handleReset = useCallback(() => {
    withTransition(() => {
      reset();
      setFiatLabel(undefined);
      setEnteredCode("");
    });
  }, [reset, withTransition]);

  // ----------------------------------
  // Status bar
  // ----------------------------------
  const statusInfo = getStatusInfo(status);

  // Determine which "step" to render based on hook status
  const isIdle = status === "idle";
  const isAwaitingCode = status === "awaiting_code";
  const isConfirming = status === "confirming" || status === "linked";
  const isPaid = status === "paid";
  const isError = status === "error" || status === "expired";

  return (
    <>
    <Nav />
    <div
      className="relative z-10 flex flex-col min-h-dvh w-full items-center"
      style={{ backgroundColor: "var(--bg-base)", paddingTop: 68 }}
    >
      {/* Header bar */}
      <header
        className="w-full max-w-[420px] flex items-center justify-between px-5 pt-6 pb-3"
        style={{ animation: "fade-in-up 0.3s ease-out both" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          <img src="/logo/logo.svg" alt="SLIK" style={{ height: 44 }} />
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
        {isIdle && !connected && (
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

        {isIdle && connected && (
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

        {isAwaitingCode && amount !== null && (
          <CodeStep
            amount={amount}
            fiatLabel={fiatLabel}
            onCodeComplete={handleCodeComplete}
            onCancel={handleReset}
          />
        )}

        {isConfirming && amount !== null && (
          <WaitingStep amount={amount} code={enteredCode} fiatLabel={fiatLabel} />
        )}

        {isPaid && amount !== null && (
          <SuccessStep
            amount={amount}
            fiatLabel={fiatLabel}
            onReset={handleReset}
          />
        )}

        {isError && (
          <ErrorStep
            message={error || (status === "expired" ? "Payment expired." : "An error occurred")}
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
    </>
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

type MerchantStatus =
  | "idle"
  | "awaiting_code"
  | "linked"
  | "confirming"
  | "paid"
  | "expired"
  | "error";

function getStatusInfo(status: MerchantStatus): {
  label: string;
  color: StatusColor;
} {
  switch (status) {
    case "idle":
      return { label: "Ready", color: "green" };
    case "awaiting_code":
      return { label: "Awaiting code", color: "yellow" };
    case "linked":
    case "confirming":
      return { label: "Processing", color: "yellow" };
    case "paid":
      return { label: "Confirmed", color: "green" };
    case "expired":
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
