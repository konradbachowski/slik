"use client";

import { Nav } from "@/components/Nav";

// ---------------------------------------------------------------------------
// Team data
// ---------------------------------------------------------------------------

interface TeamMember {
  name: string;
  role: string;
  description: string;
  initials: string;

  links: { label: string; href: string }[];
}

const team: TeamMember[] = [
  {
    name: "Konrad Bachowski",
    role: "Co-founder",
    description:
      "Full-stack developer turned AI-native builder. Leads architecture, SDK development, and Solana program design.",
    initials: "KB",

    links: [
      { label: "GitHub", href: "https://github.com/konradbachowski" },
    ],
  },
  {
    name: "Tomasz Stefaniak",
    role: "Co-founder",
    description:
      "Building the on-chain infrastructure and smart contract layer powering SLIK payments.",
    initials: "TS",

    links: [
      { label: "GitHub", href: "https://github.com/tomaszstefaniak" },
    ],
  },
  {
    name: "Jakub Kołtun",
    role: "Co-founder",
    description:
      "SDK development and frontend integration. Making SLIK easy to plug into any merchant stack.",
    initials: "KK",

    links: [
      { label: "GitHub", href: "https://github.com/kubakoltun" },
    ],
  },
  {
    name: "Daniel Dzierzęcki",
    role: "Co-founder",
    description:
      "Backend systems and payment flow orchestration. Keeping the real-time pipeline fast and reliable.",
    initials: "DD",

    links: [
      { label: "GitHub", href: "https://github.com/Dzierzyn" },
    ],
  },
];

// ---------------------------------------------------------------------------
// GitHub icon (inline SVG)
// ---------------------------------------------------------------------------

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn icon (inline SVG)
// ---------------------------------------------------------------------------

function LinkedInIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.712-2.165 1.21v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Arrow icon for apply links
// ---------------------------------------------------------------------------

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Team card
// ---------------------------------------------------------------------------

function TeamCard({ member }: { member: TeamMember }) {
  return (
    <div
      className="group"
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--border)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transition: "all var(--transition)",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 12px 40px rgba(99, 91, 255, 0.12)";
        el.style.borderColor = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--border)";
      }}
    >
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "var(--primary)",
            color: "#ffffff",
            fontFamily: "var(--font-code)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {member.initials}
        </div>

        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.3,
            }}
          >
            {member.name}
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-code)",
              color: "var(--primary)",
            }}
          >
            {member.role}
          </p>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
          flex: 1,
        }}
      >
        {member.description}
      </p>

      {/* Links */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        {member.links.map((link) => {
          const isGitHub = link.label === "GitHub";

          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-code)",
                color: "var(--text-secondary)",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: "var(--radius-btn)",
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                transition: "all var(--transition)",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-1px)";
                el.style.borderColor = "var(--primary)";
                el.style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(0)";
                el.style.borderColor = "var(--border)";
                el.style.color = "var(--text-secondary)";
              }}
            >
              {isGitHub ? <GitHubIcon /> : <LinkedInIcon />}
              {link.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamPage() {
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
        <header style={{ animation: "fade-in-up 500ms ease both" }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--primary)",
              marginBottom: 8,
              fontFamily: "var(--font-code)",
            }}
          >
            Team
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
            The people building SLIK
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
            Four builders shipping fast, shaping the future of payments on
            Solana.
          </p>
        </header>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div
          style={{
            height: 1,
            background: "var(--border)",
            margin: "40px 0",
            animation: "fade-in-up 500ms ease 80ms both",
          }}
        />

        {/* ── Team grid ───────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: 20,
            animation: "fade-in-up 500ms ease 160ms both",
          }}
        >
          {team.map((member) => (
            <TeamCard key={`${member.name}-${member.role}`} member={member} />
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────────────── */}
        <div
          style={{
            marginTop: 56,
            padding: "24px 28px",
            borderRadius: "var(--radius-card)",
            background: "var(--primary-light)",
            border: "1px solid var(--primary-dim)",
            animation: "fade-in-up 500ms ease 240ms both",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--text-secondary)",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: "var(--primary)",
                fontFamily: "var(--font-code)",
                fontSize: 13,
              }}
            >
              Building in public
            </span>{" "}
            &mdash; SLIK is an early-stage protocol. We ship weekly on devnet
            and document everything along the way. If you want to build with
            us, reach out.
          </p>
        </div>
      </div>
    </main>
    </>
  );
}
