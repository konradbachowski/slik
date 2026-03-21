"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Nav } from "@/components/Nav";
import { WalletButton } from "@/components/WalletButton";

type ViewState = "connect" | "form" | "registered" | "already" | "error";

export default function MerchantsPage() {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<ViewState>("connect");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [merchantData, setMerchantData] = useState<{
    name: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Check if wallet is already registered
  const checkWallet = useCallback(async () => {
    if (!publicKey) return;
    setChecking(true);
    try {
      const res = await fetch(
        `/api/merchants/me?wallet=${publicKey.toBase58()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.merchant) {
          setMerchantData(data.merchant);
          setState("already");
        } else {
          setState("form");
        }
      } else {
        setState("form");
      }
    } catch {
      setState("form");
    } finally {
      setChecking(false);
    }
  }, [publicKey]);

  // Auto-check when wallet connects
  const handleConnect = useCallback(() => {
    if (connected && publicKey) {
      checkWallet();
    }
  }, [connected, publicKey, checkWallet]);

  // Register merchant
  const handleRegister = useCallback(async () => {
    if (!publicKey || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/merchants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          name: name.trim(),
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Registration failed"
        );
      }
      setMerchantData({ name: name.trim(), status: "active" });
      setState("registered");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    } finally {
      setLoading(false);
    }
  }, [publicKey, name, logoUrl]);

  // Trigger check on mount if already connected
  if (connected && publicKey && state === "connect" && !checking) {
    handleConnect();
  }

  return (
    <>
      <Nav />
      <div
        style={{
          minHeight: "100dvh",
          background: "var(--bg-base)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "100px 24px 60px",
        }}
      >
        <div
          className="glass-card"
          style={{ maxWidth: 480, width: "100%", padding: 40 }}
        >
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--solana-green)",
                marginBottom: 12,
              }}
            >
              Merchant Registry
            </div>
            <h1
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text)",
                margin: "0 0 8px",
              }}
            >
              Register your business
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              Show your brand name and logo when customers pay you with SLIK.
              Registration is optional - you can accept payments without it.
            </p>
          </div>

          <div
            style={{
              height: 1,
              background: "var(--border)",
              marginBottom: 32,
            }}
          />

          {/* Connect wallet */}
          {state === "connect" && !connected && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  textAlign: "center",
                }}
              >
                Connect your merchant wallet to get started.
              </p>
              <WalletButton />
            </div>
          )}

          {/* Checking */}
          {checking && (
            <div
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "var(--text-muted)",
                fontFamily: "var(--font-code)",
                fontSize: 13,
              }}
            >
              Checking wallet...
            </div>
          )}

          {/* Registration form */}
          {state === "form" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-code)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Business name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kawiarnia XYZ"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-btn)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-base)",
                    color: "var(--text)",
                    fontFamily: "var(--font-code)",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--primary)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-code)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-btn)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-base)",
                    color: "var(--text)",
                    fontFamily: "var(--font-code)",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--primary)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-btn)",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Wallet
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  {publicKey?.toBase58().slice(0, 8)}...
                  {publicKey?.toBase58().slice(-8)}
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={!name.trim() || loading}
                className="gradient-btn"
                style={{
                  width: "100%",
                  fontSize: 15,
                  padding: "14px 28px",
                  marginTop: 8,
                  opacity: !name.trim() || loading ? 0.5 : 1,
                  cursor: !name.trim() || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Registering..." : "Register merchant"}
              </button>
            </div>
          )}

          {/* Success */}
          {state === "registered" && merchantData && (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--green-light)",
                  border: "2px solid var(--green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="var(--green)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--green)",
                }}
              >
                Registered!
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                <strong>{merchantData.name}</strong> is now visible to customers
                when they pay you.
              </p>
              <a
                href="/merchant"
                className="gradient-btn"
                style={{
                  textDecoration: "none",
                  fontSize: 14,
                  padding: "12px 28px",
                  marginTop: 8,
                }}
              >
                Open terminal
              </a>
            </div>
          )}

          {/* Already registered */}
          {state === "already" && merchantData && (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 13,
                  color: "var(--primary)",
                  fontWeight: 600,
                }}
              >
                Already registered
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                This wallet is registered as{" "}
                <strong>{merchantData.name}</strong>.
              </p>
              <a
                href="/merchant"
                className="gradient-btn"
                style={{
                  textDecoration: "none",
                  fontSize: 14,
                  padding: "12px 28px",
                }}
              >
                Open terminal
              </a>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "var(--error)",
                  fontFamily: "var(--font-code)",
                }}
              >
                {error}
              </p>
              <button
                onClick={() => setState("form")}
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-btn)",
                  padding: "8px 20px",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
