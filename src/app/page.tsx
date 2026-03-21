"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

// ---------------------------------------------------------------------------
// Animated code digit
// ---------------------------------------------------------------------------

function AnimatedDigit({ delay }: { delay: number }) {
  const [digit, setDigit] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDigit(Math.floor(Math.random() * 10));
    const interval = setInterval(() => {
      setDigit(Math.floor(Math.random() * 10));
    }, 2000 + delay * 300);
    return () => clearInterval(interval);
  }, [delay]);

  if (!mounted) return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: "clamp(48px, 8vw, 72px)",
        height: "clamp(64px, 10vw, 96px)",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-digit)",
        fontFamily: "var(--font-code)",
        fontSize: "clamp(28px, 5vw, 44px)",
        fontWeight: 700,
        color: "var(--text-muted)",
      }}
    >
      0
    </span>
  );

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: "clamp(48px, 8vw, 72px)",
        height: "clamp(64px, 10vw, 96px)",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-digit)",
        fontFamily: "var(--font-code)",
        fontSize: "clamp(28px, 5vw, 44px)",
        fontWeight: 700,
        color: "var(--primary)",
        boxShadow: "0 4px 20px rgba(99, 91, 255, 0.08)",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        animation: `digit-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay * 80}ms both`,
      }}
    >
      {digit}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scroll-triggered section
// ---------------------------------------------------------------------------

function FadeInSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <>
      <Nav />

      {/* Hero */}
      <section
        style={{
          paddingTop: "clamp(120px, 18vh, 180px)",
          paddingBottom: "clamp(80px, 12vh, 140px)",
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient orb */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,91,255,0.06) 0%, rgba(153,69,255,0.03) 40%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 100,
              background: "var(--primary-light)",
              border: "1px solid rgba(99, 91, 255, 0.12)",
              marginBottom: 28,
              animation: "fade-in-up 600ms ease 50ms both",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--solana-green)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--primary)",
                letterSpacing: "0.04em",
              }}
            >
              Built on Solana
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 700,
              lineHeight: 1.1,
              color: "var(--text)",
              margin: "0 0 20px",
              letterSpacing: "-0.02em",
              animation: "fade-in-up 600ms ease 100ms both",
            }}
          >
            Pay with a 6-digit code.
            <br />
            <span
              style={{
                backgroundImage: "var(--solana-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              On Solana.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(16px, 2.5vw, 20px)",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxWidth: 560,
              margin: "0 auto 40px",
              animation: "fade-in-up 600ms ease 200ms both",
            }}
          >
            Instant payments on Solana. No QR codes. No card
            numbers. Just tell the merchant your code.
          </p>

          {/* Animated code display */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "clamp(8px, 1.5vw, 14px)",
              marginBottom: 48,
              animation: "fade-in-up 600ms ease 300ms both",
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <AnimatedDigit key={i} delay={i} />
            ))}
          </div>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
              animation: "fade-in-up 600ms ease 400ms both",
            }}
          >
            <Link
              href="/pay"
              className="gradient-btn"
              style={{
                textDecoration: "none",
                fontSize: 15,
                padding: "14px 32px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Pay with SLIK
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/merchant"
              style={{
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                padding: "14px 32px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: "var(--radius-btn)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                background: "var(--bg-card)",
                transition: "all var(--transition)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--solana-green)";
                e.currentTarget.style.boxShadow =
                  "0 4px 20px rgba(20, 241, 149, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Receive payments
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          padding: "80px 24px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <FadeInSection>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "clamp(24px, 4vw, 36px)",
                fontWeight: 700,
                color: "var(--text)",
                margin: "0 0 12px",
                letterSpacing: "-0.01em",
              }}
            >
              How it works
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
                maxWidth: 480,
                margin: "0 auto",
              }}
            >
              The merchant sets the amount, the customer speaks a
              code, the payment is done. Simple as that.
            </p>
          </div>
        </FadeInSection>

        {/* Timeline steps */}
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {[
            {
              step: "01",
              title: "Merchant enters the amount",
              desc: "Opens the SLIK terminal, types 42 PLN. The system converts to SOL at a live rate and creates a payment request.",
              color: "var(--solana-green)",
            },
            {
              step: "02",
              title: "Customer generates a code",
              desc: "Opens the SLIK app, taps 'Generate code'. Gets a random 6-digit number - valid for 120 seconds. Tells it to the merchant verbally.",
              color: "var(--primary)",
            },
            {
              step: "03",
              title: "Merchant enters the code",
              desc: "Types the 6 digits into the terminal. The system matches the code to the payment and asks the customer for approval.",
              color: "var(--solana-green)",
            },
            {
              step: "04",
              title: "Customer approves. Done.",
              desc: "One tap in the wallet. SOL is transferred atomically with an on-chain receipt. Both sides see confirmation in ~400ms.",
              color: "var(--primary)",
            },
          ].map((item, i) => (
            <FadeInSection key={item.step} delay={i * 100}>
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  padding: "28px 0",
                  borderBottom: i < 3 ? "1px solid var(--border)" : "none",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: item.color,
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                    paddingTop: 2,
                    width: 32,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    {item.title}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* SDK section */}
      <section
        style={{
          padding: "80px 24px",
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <FadeInSection>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                For developers
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 12px",
                }}
              >
                Build with SLIK
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: "var(--text-secondary)",
                  maxWidth: 520,
                  margin: "0 auto",
                }}
              >
                Two npm packages. React hooks for customer and merchant
                flows. One catch-all API route for the backend. Ship
                payments in minutes.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={150}>
            {/* Code block */}
            <div
              style={{
                background: "#1a1a2e",
                borderRadius: "var(--radius-card)",
                padding: "28px 32px",
                fontFamily: "var(--font-code)",
                fontSize: 14,
                lineHeight: 1.8,
                overflow: "auto",
              }}
            >
              <div style={{ color: "#a3acb9" }}>
                {"// Install"}
              </div>
              <div style={{ color: "#14F195" }}>
                npm install @slik-pay/sdk @slik-pay/server
              </div>
              <br />
              <div style={{ color: "#a3acb9" }}>
                {"// React - customer side"}
              </div>
              <div>
                <span style={{ color: "#c792ea" }}>import</span>
                <span style={{ color: "#e0e0e0" }}> {"{ "}</span>
                <span style={{ color: "#82aaff" }}>usePaymentCode</span>
                <span style={{ color: "#e0e0e0" }}>{", "}</span>
                <span style={{ color: "#82aaff" }}>useSlikPay</span>
                <span style={{ color: "#e0e0e0" }}>{" }"}</span>
                <span style={{ color: "#c792ea" }}> from</span>
                <span style={{ color: "#c3e88d" }}>
                  {" '@slik-pay/sdk/react'"}
                </span>
              </div>
              <br />
              <div style={{ color: "#a3acb9" }}>
                {"// Backend - one line"}
              </div>
              <div>
                <span style={{ color: "#c792ea" }}>export const</span>
                <span style={{ color: "#e0e0e0" }}>{" { GET, POST } = "}</span>
                <span style={{ color: "#82aaff" }}>createSlikRoutes</span>
                <span style={{ color: "#e0e0e0" }}>
                  {"({ store, connection })"}
                </span>
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={300}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginTop: 32,
                flexWrap: "wrap",
              }}
            >
              <a
                href="https://github.com/konradbachowski/slik"
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-btn"
                style={{
                  textDecoration: "none",
                  fontSize: 14,
                  padding: "12px 28px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                View on GitHub
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <Link
                href="/vendors"
                style={{
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 28px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: "var(--radius-btn)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  transition: "all 0.2s ease",
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
                For vendors
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Stats / trust bar */}
      <section style={{ padding: "60px 24px" }}>
        <FadeInSection>
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 32,
              textAlign: "center",
            }}
          >
            {[
              { value: "~400ms", label: "Confirmation time" },
              { value: "0.2%", label: "Protocol fee" },
              { value: "6 digits", label: "One code, one payment" },
              { value: "$0", label: "No monthly fees" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-code)",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </FadeInSection>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "40px 24px",
          background: "var(--bg-card)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/logo/logo-96.png" alt="SLIK" style={{ height: 28, opacity: 0.5 }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Instant 6-code payments on Solana.
            </span>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Pay", href: "/pay" },
              { label: "Receive", href: "/merchant" },
              { label: "Merchants", href: "/merchants" },
              { label: "Vendors", href: "/vendors" },
              { label: "Press", href: "/press" },
              { label: "Team", href: "/team" },
              {
                label: "GitHub",
                href: "https://github.com/konradbachowski/slik",
              },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
