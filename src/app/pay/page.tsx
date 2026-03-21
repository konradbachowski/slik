"use client";

import { useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { usePaymentCode, useSlikPay } from "@slik-pay/sdk/react";
import { WalletButton } from "@/components/WalletButton";
import { CodeDisplay } from "@/components/CodeDisplay";
import { Nav } from "@/components/Nav";

type ViewState =
  | "disconnected"
  | "connected"
  | "generating"
  | "code_active"
  | "linked"
  | "signing"
  | "confirming"
  | "paid"
  | "error";

export default function Home() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const {
    code,
    expiresAt,
    status: codeStatus,
    linkedPayment,
    error: codeError,
    generate,
    reset: codeReset,
  } = usePaymentCode({ apiBaseUrl: "/api" });

  const {
    status: payStatus,
    error: payError,
    pay,
    reset: payReset,
  } = useSlikPay();

  // Derive view state from hook statuses
  function getViewState(): ViewState {
    if (!connected) return "disconnected";
    if (payStatus === "paid") return "paid";
    if (payStatus === "confirming") return "confirming";
    if (payStatus === "signing" || payStatus === "building") return "signing";
    if (payStatus === "error") return "error";
    if (codeError) return "error";
    if (codeStatus === "linked") return "linked";
    if (codeStatus === "active") return "code_active";
    if (codeStatus === "generating") return "generating";
    return "connected";
  }

  const state = getViewState();
  const error = payError || codeError;

  // Generate a payment code
  const generateCode = useCallback(() => {
    if (!publicKey) return;
    generate(publicKey.toBase58());
  }, [publicKey, generate]);

  // Handle code expiry (CodeDisplay calls this)
  const handleExpired = useCallback(() => {
    // No-op: the hook handles polling cleanup internally.
    // CodeDisplay shows its own expired UI.
  }, []);

  // Approve and sign the payment transaction
  const approvePayment = useCallback(() => {
    if (!linkedPayment || !publicKey || !sendTransaction) return;
    pay({
      paymentId: linkedPayment.paymentId,
      apiBaseUrl: "/api",
      customerPubkey: publicKey,
      connection,
      sendTransaction,
    });
  }, [linkedPayment, publicKey, sendTransaction, connection, pay]);

  // Reset to generate a new code
  const resetToConnected = useCallback(() => {
    codeReset();
    payReset();
  }, [codeReset, payReset]);

  // Truncate wallet address for display
  const walletAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  // Amount to display in paid state (from linkedPayment since hooks hold it)
  const paidAmount = linkedPayment?.amount ?? null;

  return (
    <>
    <Nav />
    <main className="relative z-10 flex-1 flex items-center justify-center p-4" style={{ paddingTop: 80 }}>
      <div
        className="glass-card w-full"
        style={{ maxWidth: 480, padding: 32 }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <div className="flex items-center gap-3 mb-1">
            {/* Logo mark */}
            <img src="/logo/logo.svg" alt="SLIK" style={{ height: 44 }} />
          </div>
          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Instant crypto payments
          </p>
        </div>

        {/* Divider */}
        <div
          className="w-full h-px mb-8"
          style={{
            background: "var(--border)",
          }}
        />

        {/* -- STATE: Disconnected -- */}
        {state === "disconnected" && (
          <div
            className="flex flex-col items-center gap-6"
            style={{ animation: "fade-in-up 500ms ease both" }}
          >
            <div className="flex flex-col items-center gap-3 mb-2">
              {/* Shield icon */}
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--green-light)",
                  border: "1px solid rgba(48, 181, 102, 0.15)",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke="var(--green)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="var(--green)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <p
                className="text-sm text-center leading-relaxed"
                style={{ color: "var(--text-secondary)", maxWidth: 280 }}
              >
                Connect your Solana wallet to generate payment codes and pay in SOL at any merchant.
              </p>
            </div>

            <WalletButton />
          </div>
        )}

        {/* -- STATE: Connected (ready to generate) -- */}
        {state === "connected" && (
          <div
            className="flex flex-col items-center gap-6"
            style={{ animation: "fade-in-up 400ms ease both" }}
          >
            {/* Wallet info */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--primary-light)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21 12V7H5a2 2 0 010-4h14v4"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 5v14a2 2 0 002 2h16v-5"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18 12a1 1 0 100 4h4v-4h-4z"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Wallet connected
                </span>
                <span
                  className="text-sm font-mono font-medium"
                  style={{
                    color: "var(--text)",
                    fontFamily: "var(--font-code)",
                  }}
                >
                  {walletAddress}
                </span>
              </div>
              <div className="ml-auto">
                <span className="status-dot active" />
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generateCode}
              className="gradient-btn w-full text-center"
              style={{ fontSize: 16, padding: "16px 28px" }}
            >
              Generate payment code
            </button>

            {/* Manage wallet */}
            <div className="w-full flex justify-center">
              <WalletButton />
            </div>
          </div>
        )}

        {/* -- STATE: Generating -- */}
        {state === "generating" && (
          <div
            className="flex flex-col items-center gap-6 py-8"
            style={{ animation: "fade-in-up 300ms ease both" }}
          >
            {/* Spinner */}
            <div
              className="rounded-full"
              style={{
                width: 48,
                height: 48,
                border: "3px solid var(--border)",
                borderTopColor: "var(--primary)",
                animation: "spin 800ms linear infinite",
              }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Generating your payment code...
            </p>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* -- STATE: Code active (waiting for merchant) -- */}
        {state === "code_active" && code && (
          <div style={{ animation: "fade-in-up 400ms ease both" }}>
            <CodeDisplay
              code={code}
              expiresAt={expiresAt}
              onExpired={handleExpired}
            />

            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={resetToConnected}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all"
                style={{
                  color: "var(--text-secondary)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                Cancel & generate new code
              </button>
            </div>
          </div>
        )}

        {/* -- STATE: Linked (merchant entered code, show amount) -- */}
        {state === "linked" && linkedPayment && (
          <div
            className="flex flex-col items-center gap-6"
            style={{ animation: "fade-in-up 400ms ease both" }}
          >
            <div className="flex items-center gap-3">
              <span className="status-dot linked" />
              <span
                className="text-sm font-medium tracking-wide uppercase"
                style={{ color: "var(--primary)" }}
              >
                Payment request received
              </span>
            </div>

            {/* Amount display */}
            <div
              className="flex flex-col items-center gap-2 p-6 rounded-2xl w-full"
              style={{
                background: "var(--primary-light)",
                border: "1px solid rgba(99, 91, 255, 0.15)",
              }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Amount to pay
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-bold"
                  style={{
                    fontSize: 48,
                    fontFamily: "var(--font-code)",
                    color: "var(--text)",
                    lineHeight: 1,
                  }}
                >
                  {linkedPayment.amount.toFixed(2)}
                </span>
                <span
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  SOL
                </span>
              </div>
              {code && (
                <span
                  className="text-xs font-mono mt-1"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-code)",
                  }}
                >
                  Code: {code}
                </span>
              )}
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl w-full"
                style={{
                  background: "var(--error-light)",
                  border: "1px solid rgba(223, 27, 65, 0.15)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="var(--error)" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs" style={{ color: "var(--error)" }}>
                  {error}
                </span>
              </div>
            )}

            <button
              onClick={approvePayment}
              className="gradient-btn w-full text-center"
              style={{ fontSize: 16, padding: "16px 28px" }}
            >
              Approve payment
            </button>

            <button
              onClick={resetToConnected}
              className="text-xs"
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              Decline
            </button>
          </div>
        )}

        {/* -- STATE: Signing -- */}
        {state === "signing" && (
          <div
            className="flex flex-col items-center gap-6 py-8"
            style={{ animation: "fade-in-up 300ms ease both" }}
          >
            <div
              className="rounded-full"
              style={{
                width: 48,
                height: 48,
                border: "3px solid var(--border)",
                borderTopColor: "var(--primary)",
                animation: "spin 800ms linear infinite",
              }}
            />
            <div className="flex flex-col items-center gap-1">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                Confirm in your wallet
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Approve the transaction in your wallet extension
              </p>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* -- STATE: Confirming -- */}
        {state === "confirming" && (
          <div
            className="flex flex-col items-center gap-6 py-8"
            style={{ animation: "fade-in-up 300ms ease both" }}
          >
            <div
              className="rounded-full"
              style={{
                width: 48,
                height: 48,
                border: "3px solid var(--border)",
                borderTopColor: "var(--green)",
                animation: "spin 800ms linear infinite",
              }}
            />
            <div className="flex flex-col items-center gap-1">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                Confirming on Solana
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Waiting for network confirmation...
              </p>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* -- STATE: Paid -- */}
        {state === "paid" && (
          <div
            className="flex flex-col items-center gap-6"
            style={{ animation: "fade-in-up 400ms ease both" }}
          >
            {/* Success animation */}
            <div className="relative flex items-center justify-center">
              {/* Particles */}
              <SuccessParticles />

              {/* Ring */}
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 80,
                  height: 80,
                  border: "3px solid var(--success)",
                  animation: "check-ring 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}
              >
                {/* Checkmark */}
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    animation: "check-scale 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both",
                  }}
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="var(--success)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--success)" }}
              >
                Payment successful
              </h2>
              {paidAmount !== null && (
                <p
                  className="text-2xl font-bold font-mono"
                  style={{
                    color: "var(--text)",
                    fontFamily: "var(--font-code)",
                  }}
                >
                  {paidAmount.toFixed(2)} SOL
                </p>
              )}
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Transaction confirmed on Solana
              </p>
            </div>

            <button
              onClick={resetToConnected}
              className="gradient-btn w-full text-center"
              style={{ fontSize: 15, padding: "14px 24px" }}
            >
              Done
            </button>
          </div>
        )}

        {/* -- STATE: Error -- */}
        {state === "error" && (
          <div
            className="flex flex-col items-center gap-6"
            style={{ animation: "fade-in-up 400ms ease both" }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                background: "var(--error-light)",
                border: "1px solid rgba(223, 27, 65, 0.15)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" stroke="var(--error)" strokeWidth="1.5" />
                <path d="M15 9l-6 6M9 9l6 6" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <div className="flex flex-col items-center gap-1">
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--error)" }}
              >
                Something went wrong
              </h2>
              {error && (
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--text-secondary)", maxWidth: 300 }}
                >
                  {error}
                </p>
              )}
            </div>

            <button
              onClick={resetToConnected}
              className="gradient-btn w-full text-center"
              style={{ fontSize: 15, padding: "14px 24px" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Success particles (CSS-only confetti effect)                       */
/* ------------------------------------------------------------------ */

function SuccessParticles() {
  const particles = [
    { x: -40, y: -35, rotate: 15, color: "var(--primary)", delay: 0, size: 6 },
    { x: 35, y: -40, rotate: -25, color: "var(--green)", delay: 50, size: 5 },
    { x: -30, y: 30, rotate: 45, color: "var(--success)", delay: 100, size: 7 },
    { x: 40, y: 25, rotate: -15, color: "var(--primary)", delay: 150, size: 5 },
    { x: -15, y: -45, rotate: 60, color: "var(--warning)", delay: 80, size: 4 },
    { x: 20, y: 40, rotate: -40, color: "var(--green)", delay: 120, size: 6 },
    { x: -45, y: 0, rotate: 30, color: "var(--success)", delay: 60, size: 5 },
    { x: 45, y: -10, rotate: -55, color: "var(--primary)", delay: 140, size: 4 },
  ];

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: p.size > 5 ? "2px" : "50%",
            background: p.color,
            animation: `particle-burst 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}ms both`,
            transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes particle-burst {
          0% {
            transform: translate(0, 0) scale(0);
            opacity: 1;
          }
          100% {
            transform: var(--particle-end, translate(40px, -40px)) scale(1);
            opacity: 0;
          }
        }
      `}</style>
      {particles.map((p, i) => (
        <style key={`style-${i}`}>{`
          div:nth-child(${i + 1}) {
            --particle-end: translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg);
          }
        `}</style>
      ))}
    </>
  );
}
