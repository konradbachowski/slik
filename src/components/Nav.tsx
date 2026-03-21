"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Pay", href: "/pay" },
  { label: "Merchant", href: "/merchant" },
  { label: "Vendors", href: "/vendors" },
  { label: "Press", href: "/press" },
  { label: "Team", href: "/team" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close menu on route change (link click)
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background:
            scrolled || menuOpen
              ? "rgba(246, 249, 252, 0.95)"
              : "transparent",
          backdropFilter:
            scrolled || menuOpen ? "blur(16px) saturate(180%)" : "none",
          borderBottom:
            scrolled || menuOpen
              ? "1px solid var(--border)"
              : "1px solid transparent",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            onClick={closeMenu}
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <img src="/logo/logo.svg" alt="SLIK" style={{ height: 48 }} />
          </Link>

          {/* Desktop links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
            className="nav-desktop"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/konradbachowski/slik"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--primary)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--primary)";
              }}
            >
              GitHub
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-hamburger"
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              color: "var(--text)",
            }}
            aria-label="Menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div
            className="nav-mobile-menu"
            style={{
              display: "none",
              flexDirection: "column",
              gap: 4,
              padding: "8px 24px 24px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-light)",
                  transition: "color 0.2s",
                }}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/konradbachowski/slik"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
                padding: "12px 0",
              }}
            >
              GitHub
            </a>
          </div>
        )}
      </nav>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
          .nav-mobile-menu { display: flex !important; }
        }
      `}</style>
    </>
  );
}
