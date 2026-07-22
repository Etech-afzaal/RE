"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./SiteHeader.module.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Sale", href: "/?type=sale#properties" },
  { label: "Rent", href: "/?type=rent#properties" },
  { label: "Plots", href: "/?type=plot#properties" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#why-us" },
];

export default function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleHomeClick = async (event) => {
    event.preventDefault();
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));
    await router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" onClick={handleHomeClick} className={styles.logoGroup}>
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
            <Link
              key={link.label}
              href={link.href}
              className={styles.navLink}
              onClick={link.label === "Home" ? handleHomeClick : undefined}
            >
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
              onClick={(event) => {
                if (link.label === "Home") {
                  handleHomeClick(event);
                }
                setMenuOpen(false);
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
