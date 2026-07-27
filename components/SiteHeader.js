"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./SiteHeader.module.css";

const DEFAULT_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Sale", href: "#sale" },
  { label: "Rent", href: "#rent" },
  { label: "Plots", href: "#plots" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#contact" },
];

function getNavSections(navLinks) {
  return navLinks
    .filter((link) => link.href.startsWith("#"))
    .map((link) => {
      const element = document.getElementById(link.href.slice(1));
      return element ? { href: link.href, element } : null;
    })
    .filter(Boolean);
}

function getProbeY() {
  const header = document.querySelector("header");
  const headerHeight = header?.getBoundingClientRect().height ?? 72;
  // Must sit at/below scroll-margin landing (110px) so hash jumps activate correctly
  return Math.max(headerHeight + 8, 120);
}

export default function SiteHeader({ navLinks = DEFAULT_NAV_LINKS }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("/");
  const lockedHrefRef = useRef(null);
  const lockTimerRef = useRef(0);

  useEffect(() => {
    const syncActive = () => {
      const sections = getNavSections(navLinks);
      if (sections.length === 0) {
        setActiveHref("/");
        return;
      }

      const probe = getProbeY();
      const lockedHref = lockedHrefRef.current;

      if (lockedHref) {
        const target = sections.find((section) => section.href === lockedHref);
        const reached = target && target.element.getBoundingClientRect().top <= probe + 2;
        if (!reached) {
          setActiveHref(lockedHref);
          return;
        }
        lockedHrefRef.current = null;
        window.clearTimeout(lockTimerRef.current);
      }

      const firstTop = sections[0].element.getBoundingClientRect().top;
      if (firstTop > probe) {
        setActiveHref("/");
        return;
      }

      let nextHref = sections[0].href;
      for (const section of sections) {
        if (section.element.getBoundingClientRect().top <= probe) {
          nextHref = section.href;
        }
      }

      setActiveHref(nextHref);
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        syncActive();
        ticking = false;
      });
    };

    syncActive();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("hashchange", syncActive);

    const retryIds = [100, 400, 1000].map((ms) => window.setTimeout(syncActive, ms));

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("hashchange", syncActive);
      window.clearTimeout(lockTimerRef.current);
      retryIds.forEach((id) => window.clearTimeout(id));
    };
  }, [navLinks]);

  const isActiveLink = (href) => href === activeHref;

  const handleHomeClick = async (event) => {
    event.preventDefault();
    lockedHrefRef.current = null;
    window.clearTimeout(lockTimerRef.current);
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));
    await router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveHref("/");
  };

  const handleSectionClick = (event, href) => {
    event.preventDefault();
    const element = document.getElementById(href.slice(1));
    lockedHrefRef.current = href;
    setActiveHref(href);
    setMenuOpen(false);
    window.clearTimeout(lockTimerRef.current);
    lockTimerRef.current = window.setTimeout(() => {
      lockedHrefRef.current = null;
    }, 1200);

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.location.hash !== href) {
      window.history.pushState(null, "", href);
    }
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
          {navLinks.map((link) => {
            const active = isActiveLink(link.href);
            const isHash = link.href.startsWith("#");
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`.trim()}
                onClick={
                  link.href === "/"
                    ? handleHomeClick
                    : isHash
                      ? (event) => handleSectionClick(event, link.href)
                      : () => setMenuOpen(false)
                }
              >
                {link.label}
              </Link>
            );
          })}
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
          {navLinks.map((link) => {
            const active = isActiveLink(link.href);
            const isHash = link.href.startsWith("#");
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`${styles.mobileLink} ${active ? styles.navLinkActive : ""}`.trim()}
                onClick={(event) => {
                  if (link.href === "/") {
                    handleHomeClick(event);
                    setMenuOpen(false);
                    return;
                  }
                  if (isHash) {
                    handleSectionClick(event, link.href);
                    return;
                  }
                  setMenuOpen(false);
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
