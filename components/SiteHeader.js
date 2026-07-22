"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./SiteHeader.module.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "For Sale", href: "#listings" },
  { label: "For Rent", href: "#listings" },
  { label: "Property", href: "#listings" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#why-us" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logoGroup}>
          <Image
            src="/logo.svg"
            alt="Dhalahore Properties"
            width={169}
            height={47}
            priority
          />
        </Link>

        <nav className={styles.mainNav} aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/agent/login" className={styles.agentButton}>
            Become an agent
          </Link>
          <button
            type="button"
            className={styles.hamburger}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6.5h16M4 12h16M4 17.5h16"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="mobile-menu" className={styles.mobileMenu} aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
