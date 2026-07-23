"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./SiteHeader.module.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Sale", href: "#sale" },
  { label: "Rent", href: "#rent" },
  { label: "Plots", href: "#plots" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#contact" },
];

export default function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("/");

  useEffect(() => {
    const sectionLinks = NAV_LINKS.filter((link) => link.href.startsWith("#"));
    const sections = sectionLinks
      .map((link) => ({ href: link.href, element: document.getElementById(link.href.slice(1)) }))
      .filter((item) => item.element);

    if (sections.length === 0) {
      return undefined;
    }

    const sortedSections = sections.sort((a, b) => a.element.offsetTop - b.element.offsetTop);
    const firstSectionTop = sortedSections[0].element.offsetTop;
    const homeReleaseThreshold = firstSectionTop - window.innerHeight * 0.4;

    const getBestEntry = (entries) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length === 0) {
        return null;
      }

      return visibleEntries.reduce((best, entry) => {
        if (!best) return entry;
        return entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best;
      }, null);
    };

    const sectionState = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < homeReleaseThreshold) {
          setActiveHref("/");
          return;
        }

        entries.forEach((entry) => {
          sectionState.set(entry.target.id, entry);
        });

        const bestEntry = getBestEntry(Array.from(sectionState.values()));
        if (bestEntry) {
          setActiveHref(`#${bestEntry.target.id}`);
          return;
        }

        const nextSection = sortedSections.find((section) => section.element.getBoundingClientRect().top >= 0);
        if (nextSection) {
          setActiveHref(nextSection.href);
          return;
        }

        setActiveHref(sortedSections[sortedSections.length - 1].href);
      },
      {
        root: null,
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((section) => observer.observe(section.element));

    return () => observer.disconnect();
  }, []);

  const isActiveLink = (href) => href === activeHref;

  const handleHomeClick = async (event) => {
    event.preventDefault();
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));
    await router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveHref("/");
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
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`.trim()}
                onClick={link.label === "Home" ? handleHomeClick : link.href === "#sale" ? () => setActiveHref("#sale") : undefined}
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
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`${styles.mobileLink} ${active ? styles.navLinkActive : ""}`.trim()}
                onClick={(event) => {
                  if (link.label === "Home") {
                    handleHomeClick(event);
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
