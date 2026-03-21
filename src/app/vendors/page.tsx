"use client";

import { Nav } from "@/components/Nav";

export default function VendorsPage() {
  return (
    <>
    <Nav />
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#f6f9fc",
        color: "#1a1a2e",
      }}
    >

      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "100px 24px 64px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontFamily: "var(--font-code)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#30b566",
            background: "rgba(48, 181, 102, 0.08)",
            border: "1px solid rgba(48, 181, 102, 0.2)",
            borderRadius: 20,
            padding: "6px 16px",
            marginBottom: 28,
          }}
        >
          For merchants
        </div>

        <h1
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#1a1a2e",
            margin: "0 auto 20px",
            maxWidth: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Accept instant crypto payments with{" "}
          <span style={{ color: "#635BFF" }}>SLIK</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2.5vw, 19px)",
            lineHeight: 1.7,
            color: "#697386",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          Zero chargebacks. Sub-second settlement. 0.2% protocol fee.
          For qualifying merchants, we handle the full integration - from setup to ongoing support.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-code)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3acb9",
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          How it works for merchants
        </h2>

        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <StepCard
            step={1}
            title="Connect wallet"
            description="Open the SLIK merchant terminal and connect your Solana wallet. That's your payment destination."
          />
          <StepCard
            step={2}
            title="Enter amount"
            description="Type the amount in PLN, USD or EUR. SLIK auto-converts to SOL at live rates."
          />
          <StepCard
            step={3}
            title="Get paid"
            description="Customer tells you their 6-digit code. Enter it. Payment confirmed in under 1 second."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Why SLIK */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-code)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3acb9",
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          Why merchants choose SLIK
        </h2>

        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="No chargebacks"
            description="Blockchain payments are final. No disputes, no fraud-related reversals eating into your margins."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#30b566" strokeWidth="1.5" />
                <polyline
                  points="12 6 12 12 16 14"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="~400ms settlement"
            description="Solana confirms in under a second. No pending, no clearing days. You see the money instantly."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <line
                  x1="12"
                  y1="1"
                  x2="12"
                  y2="23"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="0.2% protocol fee"
            description="Flat rate, no monthly fees, no minimums. Compared to 1.5-3% on card processors - you keep more."
          />
          <BenefitCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="7" r="4" stroke="#30b566" strokeWidth="1.5" />
                <path
                  d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                  stroke="#30b566"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="Full integration support"
            description="Qualifying merchants get hands-on onboarding, SDK integration, and ongoing technical support from our team."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Integration */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e3e8ee",
            borderRadius: 16,
            padding: "48px 40px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "clamp(20px, 3vw, 26px)",
              fontWeight: 700,
              color: "#1a1a2e",
              marginBottom: 12,
              letterSpacing: "-0.01em",
            }}
          >
            Already have an app?
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: "#697386",
              marginBottom: 32,
              maxWidth: 520,
            }}
          >
            Integrate SLIK payments with a few lines of code.
          </p>

          <div
            style={{
              background: "#1a1a2e",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
              overflow: "auto",
            }}
          >
            <code
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 14,
                color: "#e3e8ee",
                lineHeight: 1.6,
                whiteSpace: "pre",
              }}
            >
              <span style={{ color: "#a3acb9" }}>$</span>{" "}
              <span style={{ color: "#14F195" }}>npm install</span>{" "}
              @slik-pay/sdk @slik-pay/server
            </code>
          </div>

          <a
            href="https://github.com/konradbachowski/slik"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-code)",
              fontSize: 14,
              fontWeight: 600,
              color: "#635BFF",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.2s ease",
            }}
          >
            View SDK documentation on GitHub
            <span style={{ fontSize: 16 }}>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 100px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800,
            color: "#1a1a2e",
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          Ready to get started?
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "#697386",
            marginBottom: 40,
            maxWidth: 460,
            margin: "0 auto 40px",
          }}
        >
          Try the merchant terminal now or schedule a call to discuss integration for your business.
        </p>

        <div
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href="/merchant"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-code)",
              fontSize: 15,
              fontWeight: 700,
              color: "#ffffff",
              backgroundColor: "#30b566",
              padding: "16px 32px",
              borderRadius: 12,
              textDecoration: "none",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 16px rgba(48, 181, 102, 0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 32px rgba(48, 181, 102, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 16px rgba(48, 181, 102, 0.25)";
            }}
          >
            Start accepting payments
            <span>&rarr;</span>
          </a>

          <a
            href="https://cal.com/konrad-bachowski/consultation-heyneuron"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-code)",
              fontSize: 15,
              fontWeight: 700,
              color: "#1a1a2e",
              backgroundColor: "transparent",
              padding: "16px 32px",
              borderRadius: 12,
              textDecoration: "none",
              border: "2px solid #e3e8ee",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#635BFF";
              e.currentTarget.style.color = "#635BFF";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e3e8ee";
              e.currentTarget.style.color = "#1a1a2e";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Schedule a call
            <span>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 40px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, #e3e8ee, transparent)",
            marginBottom: 24,
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-code)",
            fontSize: 12,
            color: "#a3acb9",
          }}
        >
          SLIK - Solana payment protocol
        </p>
      </footer>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step card component                                                  */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e3e8ee",
        borderRadius: 16,
        padding: "32px 28px",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(48, 181, 102, 0.3)";
        e.currentTarget.style.boxShadow =
          "0 8px 24px rgba(48, 181, 102, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e3e8ee";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-code)",
          fontSize: 12,
          fontWeight: 700,
          color: "#30b566",
          letterSpacing: "0.08em",
          marginBottom: 16,
        }}
      >
        STEP {step}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-code)",
          fontSize: 18,
          fontWeight: 700,
          color: "#1a1a2e",
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#697386",
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Benefit card component                                               */
/* ------------------------------------------------------------------ */

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e3e8ee",
        borderRadius: 16,
        padding: "28px 24px",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(48, 181, 102, 0.3)";
        e.currentTarget.style.boxShadow =
          "0 8px 24px rgba(48, 181, 102, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e3e8ee";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(48, 181, 102, 0.08)",
          border: "1px solid rgba(48, 181, 102, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-code)",
          fontSize: 15,
          fontWeight: 700,
          color: "#1a1a2e",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "#697386",
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}
