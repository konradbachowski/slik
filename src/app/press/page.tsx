"use client";

import { Nav } from "@/components/Nav";

const colors = [
  { label: "SLIK Purple", hex: "#635BFF", note: "Primary brand" },
  { label: "Solana Purple", hex: "#9945FF", note: "" },
  { label: "Solana Green", hex: "#14F195", note: "" },
  { label: "Dark", hex: "#1a1a2e", note: "" },
];

export default function PressPage() {
  return (
    <>
    <Nav />
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        fontFamily: "var(--font-body)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "96px 24px 96px",
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <header
          style={{ animation: "fade-in-up 500ms ease both" }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--primary)",
              marginBottom: 8,
            }}
          >
            Press
          </p>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: 0,
            }}
          >
            Brand &amp; Press
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              marginTop: 12,
              maxWidth: 520,
            }}
          >
            Guidelines for using SLIK in communications.
          </p>
        </header>

        <Divider delay={80} />

        {/* ── About SLIK ──────────────────────────────────────── */}
        <Section title="About SLIK" delay={120}>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              margin: 0,
              maxWidth: 680,
            }}
          >
            SLIK is an instant payment protocol on Solana.
            Customers generate a 6-digit code,
            tell it to the merchant, and approve the payment &mdash; SOL is
            transferred atomically with an on-chain receipt.
          </p>
        </Section>

        <Divider delay={160} />

        {/* ── Logo ────────────────────────────────────────────── */}
        <Section title="Logo" delay={200}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 24,
            }}
          >
            {/* Light background */}
            <div
              className="glass-card"
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                On light
              </p>
              <img src="/logo/logo.svg" alt="SLIK" style={{ height: 40 }} />
            </div>

            {/* Dark background */}
            <div
              className="glass-card"
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                background: "#1a1a2e",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.45)",
                  margin: 0,
                }}
              >
                On dark
              </p>
              <img src="/logo/logo-white.svg" alt="SLIK" style={{ height: 40 }} />
            </div>
          </div>

          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginTop: 20,
            }}
          >
            Download assets: coming soon
          </p>
        </Section>

        <Divider delay={240} />

        {/* ── Colors ──────────────────────────────────────────── */}
        <Section title="Colors" delay={280}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 20,
            }}
          >
            {colors.map((c) => (
              <div key={c.hex} className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    height: 96,
                    background: c.hex,
                    borderRadius: "var(--radius-card) var(--radius-card) 0 0",
                  }}
                />
                <div style={{ padding: "14px 16px 16px" }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text)",
                      margin: 0,
                    }}
                  >
                    {c.label}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-code)",
                      color: "var(--text-muted)",
                      margin: "4px 0 0",
                    }}
                  >
                    {c.hex}
                  </p>
                  {c.note && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        margin: "4px 0 0",
                      }}
                    >
                      {c.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Divider delay={320} />

        {/* ── Typography ──────────────────────────────────────── */}
        <Section title="Typography" delay={360}>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              margin: 0,
              maxWidth: 680,
            }}
          >
            SLIK uses{" "}
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontWeight: 500,
                color: "var(--text)",
              }}
            >
              JetBrains Mono
            </span>{" "}
            for code and numerical displays, and system sans-serif for body
            text.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginTop: 24,
            }}
          >
            <div
              className="glass-card"
              style={{ padding: "24px 28px" }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: "0 0 12px",
                }}
              >
                Monospace
              </p>
              <p
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 28,
                  fontWeight: 600,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                847 291
              </p>
              <p
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  margin: "8px 0 0",
                }}
              >
                JetBrains Mono
              </p>
            </div>

            <div
              className="glass-card"
              style={{ padding: "24px 28px" }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: "0 0 12px",
                }}
              >
                Sans-serif
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 28,
                  fontWeight: 600,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Instant payments
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  margin: "8px 0 0",
                }}
              >
                System sans-serif
              </p>
            </div>
          </div>
        </Section>

        <Divider delay={400} />

        {/* ── Quick description (blockquote) ──────────────────── */}
        <Section title="Quick description" delay={440}>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "0 0 12px",
            }}
          >
            For media use &mdash; copy-paste ready.
          </p>
          <blockquote
            style={{
              margin: 0,
              padding: "24px 28px",
              background: "var(--primary-light)",
              borderLeft: "3px solid var(--primary)",
              borderRadius: "0 var(--radius-card) var(--radius-card) 0",
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text)",
              fontStyle: "normal",
            }}
          >
            SLIK is an open-source payment protocol built on Solana that
            enables instant 6-digit code payments.
          </blockquote>
        </Section>

        <Divider delay={480} />

        {/* ── Press inquiries ─────────────────────────────────── */}
        <section
          style={{
            animation: "fade-in-up 500ms ease both",
            animationDelay: "500ms",
            paddingTop: 40,
          }}
        >
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            For press inquiries, contact{" "}
            <a
              href="mailto:press@slik.dev"
              style={{
                color: "var(--primary)",
                textDecoration: "none",
                fontWeight: 500,
                borderBottom: "1px solid rgba(99, 91, 255, 0.3)",
              }}
            >
              press@slik.dev
            </a>
          </p>
        </section>
      </div>
    </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper with staggered animation                            */
/* ------------------------------------------------------------------ */

function Section({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        animation: "fade-in-up 500ms ease both",
        animationDelay: `${delay}ms`,
        paddingTop: 40,
      }}
    >
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--text)",
          margin: "0 0 20px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Divider with staggered animation                                    */
/* ------------------------------------------------------------------ */

function Divider({ delay }: { delay: number }) {
  return (
    <div
      style={{
        height: 1,
        background: "var(--border)",
        marginTop: 40,
        animation: "fade-in-up 500ms ease both",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}
