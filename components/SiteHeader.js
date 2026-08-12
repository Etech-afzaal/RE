"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import styles from "./SiteHeader.module.css";

const DEFAULT_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Sale", href: "#sale" },
  { label: "Rent", href: "#rent" },
  { label: "Plots", href: "#plots" },
  { label: "Areas", href: "#areas" },
  { label: "Contact Us", href: "#contact" },
];

function getAgentHomeHref(pathname) {
  const match = String(pathname || "").match(/^\/re\/([^/]+)/);
  if (!match) return "/";
  return `/re/${decodeURIComponent(match[1])}`;
}

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

export default function SiteHeader({
  navLinks = DEFAULT_NAV_LINKS,
  ctaLabel = "Become an agent",
  ctaHref = "/agent/login",
  logoSrc = "/logo.svg",
  logoAlt = "Dhalahore Properties",
  logoScrollTarget,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const homeHref = useMemo(() => getAgentHomeHref(pathname), [pathname]);
  const resolvedNavLinks = useMemo(
    () =>
      navLinks.map((link) =>
        link.label === "Home" || link.href === "/"
          ? { ...link, href: homeHref }
          : link,
      ),
    [navLinks, homeHref],
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEntered, setMenuEntered] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [activeHref, setActiveHref] = useState(homeHref);
  const lockedHrefRef = useRef(null);
  const lockTimerRef = useRef(0);
  const closeTimerRef = useRef(0);

  useEffect(() => {
    if (menuOpen) {
      window.clearTimeout(closeTimerRef.current);
      setMenuMounted(true);
      const enterId = requestAnimationFrame(() => {
        requestAnimationFrame(() => setMenuEntered(true));
      });
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        cancelAnimationFrame(enterId);
        document.body.style.overflow = prevOverflow;
      };
    }

    setMenuEntered(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMenuMounted(false);
    }, 420);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [menuOpen]);

  useEffect(() => {
    const syncActive = () => {
      const sections = getNavSections(resolvedNavLinks);
      if (sections.length === 0) {
        setActiveHref(homeHref);
        return;
      }

      const probe = getProbeY();
      const lockedHref = lockedHrefRef.current;

      if (lockedHref) {
        const target = sections.find((section) => section.href === lockedHref);
        const reached =
          target && target.element.getBoundingClientRect().top <= probe + 2;
        if (!reached) {
          setActiveHref(lockedHref);
          return;
        }
        lockedHrefRef.current = null;
        window.clearTimeout(lockTimerRef.current);
      }

      const firstTop = sections[0].element.getBoundingClientRect().top;
      if (firstTop > probe) {
        setActiveHref(homeHref);
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

    const retryIds = [100, 400, 1000].map((ms) =>
      window.setTimeout(syncActive, ms),
    );

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("hashchange", syncActive);
      window.clearTimeout(lockTimerRef.current);
      retryIds.forEach((id) => window.clearTimeout(id));
    };
  }, [resolvedNavLinks, homeHref]);

  const isActiveLink = (href) => href === activeHref;

  const isHomeLink = (href) => href === homeHref || href === "/";

  const handleLogoClick = async (event) => {
    event.preventDefault();
    lockedHrefRef.current = null;
    window.clearTimeout(lockTimerRef.current);
    setMenuOpen(false);
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));

    if (logoScrollTarget) {
      const target = document.getElementById(logoScrollTarget);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveHref(homeHref);
      return;
    }

    await router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveHref("/");
  };

  const handleHomeClick = async (event) => {
    event.preventDefault();
    lockedHrefRef.current = null;
    window.clearTimeout(lockTimerRef.current);
    setMenuOpen(false);

    if (homeHref.startsWith("/re/")) {
      window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));
      const heroTarget = `${homeHref}#hero`;
      if (pathname !== homeHref) {
        await router.push(heroTarget);
      } else {
        const hero = document.getElementById("hero");
        if (hero) {
          hero.scrollIntoView({ behavior: "smooth", block: "start" });
          if (window.location.hash !== "#hero") {
            window.history.pushState(null, "", "#hero");
          }
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      setActiveHref(homeHref);
      return;
    }

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

  const homeLinkHref = homeHref.startsWith("/re/")
    ? `${homeHref}#hero`
    : homeHref;

  return (
    <header
      className={`${styles.header} ${menuEntered ? styles.headerMenuOpen : ""}`.trim()}
    >
      {menuMounted ? (
        <button
          type="button"
          className={`${styles.mobileOverlay} ${menuEntered ? styles.mobileOverlayVisible : ""}`.trim()}
          aria-label="Close menu"
          tabIndex={menuEntered ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={styles.topBar}>
        <div className={styles.inner}>
          <Link
            href={logoScrollTarget ? `#${logoScrollTarget}` : "/"}
            onClick={handleLogoClick}
            className={styles.logoGroup}
          >
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={PUBLIC_SITE_LOGO_DIMENSIONS.width}
              height={PUBLIC_SITE_LOGO_DIMENSIONS.height}
              quality={PUBLIC_SITE_LOGO_DIMENSIONS.quality}
              sizes={PUBLIC_SITE_LOGO_DIMENSIONS.sizes}
              priority
              className={styles.logoImage}
            />
          </Link>

          <nav className={styles.mainNav} aria-label="Main">
            {resolvedNavLinks.map((link) => {
              const active = isActiveLink(link.href);
              const isHash = link.href.startsWith("#");
              return (
                <Link
                  key={link.label}
                  href={isHomeLink(link.href) ? homeLinkHref : link.href}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`.trim()}
                  onClick={
                    isHomeLink(link.href)
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
            <Link
              href={ctaHref}
              className={styles.agentButton}
              onClick={
                ctaHref.startsWith("#")
                  ? (event) => handleSectionClick(event, ctaHref)
                  : undefined
              }
            >
              {ctaLabel}
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
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
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
      </div>

      {menuMounted ? (
        <nav
          id="mobile-menu"
          className={`${styles.mobileMenu} ${menuEntered ? styles.mobileMenuOpen : ""}`.trim()}
          aria-label="Mobile"
          aria-hidden={!menuEntered}
        >
          {resolvedNavLinks.map((link, index) => {
            const active = isActiveLink(link.href);
            const isHash = link.href.startsWith("#");
            return (
              <Link
                key={link.label}
                href={isHomeLink(link.href) ? homeLinkHref : link.href}
                className={`${styles.mobileLink} ${active ? styles.navLinkActive : ""}`.trim()}
                style={{ "--stagger": `${index * 50}ms` }}
                tabIndex={menuEntered ? 0 : -1}
                onClick={(event) => {
                  if (isHomeLink(link.href)) {
                    handleHomeClick(event);
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
          <Link
            href={ctaHref}
            className={styles.mobileCta}
            style={{ "--stagger": `${resolvedNavLinks.length * 50}ms` }}
            tabIndex={menuEntered ? 0 : -1}
            onClick={(event) => {
              if (ctaHref.startsWith("#")) {
                handleSectionClick(event, ctaHref);
                return;
              }
              setMenuOpen(false);
            }}
          >
            {ctaLabel}
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
