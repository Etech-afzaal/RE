"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import {
  normalizePropertySubtype,
  normalizePropertyType,
} from "@/lib/propertyTaxonomy";
import {
  listingMainSectionId,
  listingScrollTargetId,
} from "@/lib/agentPublicListingSections";
import styles from "./SiteHeader.module.css";

const DEFAULT_NAV_LINKS = [
  { label: "Home", href: "/" },
  {
    label: "Sale",
    href: "#sale",
    type: "sale",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    label: "Rent",
    href: "#rent",
    type: "rent",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    label: "Plots",
    href: "#plots",
    type: "plot",
    children: [
      { label: "Residential", subtype: "residential_plot" },
      { label: "Commercial", subtype: "commercial_plot" },
    ],
  },
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

function sectionIdFromType(type) {
  if (type === "plot") return "plots";
  return type || "";
}

export default function SiteHeader({
  navLinks = DEFAULT_NAV_LINKS,
  ctaLabel = "Become an Agent",
  ctaHref = "/agent/signup",
  logoSrc = "/logo.svg",
  logoAlt = "Dhalahore Properties",
  logoScrollTarget,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const homeHref = useMemo(() => getAgentHomeHref(pathname), [pathname]);
  const isAgentPublicSite = homeHref.startsWith("/re/");
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
  // Subtype filter active state (e.g. "Apartments" under "For Sale") — purely
  // visual; the existing scroll-based section highlight stays unchanged.
  const [activeSubtype, setActiveSubtype] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [openMobileGroup, setOpenMobileGroup] = useState(null);
  // Desktop category menus: only one open at a time; independent of filter/URL.
  const [activeDropdown, setActiveDropdown] = useState(null);
  // After a click, ignore hover-open until the pointer leaves the nav item.
  // Prevents scrollIntoView under the sticky header from re-firing mouseEnter.
  const [hoverArmed, setHoverArmed] = useState(true);
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
    setOpenMobileGroup(null);
    closeTimerRef.current = window.setTimeout(() => {
      setMenuMounted(false);
    }, 420);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [menuOpen]);

  // Sync subtype highlight from URL (customer site filter nav only).
  useEffect(() => {
    if (homeHref.startsWith("/re/")) return;

    const syncSubtype = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveType(normalizePropertyType(params.get("type")));
      setActiveSubtype(normalizePropertySubtype(params.get("subtype")));
    };
    syncSubtype();
    window.addEventListener("popstate", syncSubtype);
    return () => window.removeEventListener("popstate", syncSubtype);
  }, [homeHref]);

  useEffect(() => {
    if (isAgentPublicSite) return;

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
  }, [resolvedNavLinks, homeHref, isAgentPublicSite]);

  // Agent public: scroll-spy for listing main + subtype sections (no URL filters).
  useEffect(() => {
    if (!isAgentPublicSite) return;

    const buildListingTargets = () => {
      const targets = [];

      for (const link of resolvedNavLinks) {
        if (!link.type) continue;

        const mainId = listingMainSectionId(link.type);
        const mainEl = document.getElementById(mainId);
        if (mainEl) {
          targets.push({
            href: link.href,
            type: link.type,
            subtype: null,
            element: mainEl,
          });
        }

        if (!Array.isArray(link.children)) continue;
        for (const child of link.children) {
          const subId = listingScrollTargetId(link.type, child.subtype);
          const subEl = document.getElementById(subId);
          if (subEl) {
            targets.push({
              href: link.href,
              type: link.type,
              subtype: child.subtype,
              element: subEl,
            });
          }
        }
      }

      return targets.sort(
        (a, b) => a.element.offsetTop - b.element.offsetTop,
      );
    };

    const syncListingActive = () => {
      const listingTargets = buildListingTargets();
      const otherSections = getNavSections(
        resolvedNavLinks.filter((link) => !link.type),
      );
      const probe = getProbeY();
      const lockedHref = lockedHrefRef.current;

      if (lockedHref) {
        const lockedListing = listingTargets.find((t) => t.href === lockedHref);
        const lockedOther = otherSections.find((s) => s.href === lockedHref);
        const lockedEl = lockedListing?.element || lockedOther?.element;
        const reached =
          lockedEl && lockedEl.getBoundingClientRect().top <= probe + 2;
        if (!reached) {
          setActiveHref(lockedHref);
          return;
        }
        lockedHrefRef.current = null;
        window.clearTimeout(lockTimerRef.current);
      }

      let matchedListing = null;
      for (const target of listingTargets) {
        if (target.element.getBoundingClientRect().top <= probe + 2) {
          matchedListing = target;
        }
      }

      if (matchedListing) {
        setActiveHref(matchedListing.href);
        setActiveType(matchedListing.type);
        setActiveSubtype(matchedListing.subtype);
        return;
      }

      if (otherSections.length === 0) {
        setActiveHref(homeHref);
        setActiveType(null);
        setActiveSubtype(null);
        return;
      }

      const firstTop = otherSections[0].element.getBoundingClientRect().top;
      if (firstTop > probe) {
        setActiveHref(homeHref);
        setActiveType(null);
        setActiveSubtype(null);
        return;
      }

      let nextHref = otherSections[0].href;
      for (const section of otherSections) {
        if (section.element.getBoundingClientRect().top <= probe) {
          nextHref = section.href;
        }
      }

      setActiveHref(nextHref);
      setActiveType(null);
      setActiveSubtype(null);
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        syncListingActive();
        ticking = false;
      });
    };

    syncListingActive();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    const retryIds = [100, 400, 1000].map((ms) =>
      window.setTimeout(syncListingActive, ms),
    );

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.clearTimeout(lockTimerRef.current);
      retryIds.forEach((id) => window.clearTimeout(id));
    };
  }, [resolvedNavLinks, homeHref, isAgentPublicSite]);

  const isActiveLink = (href) => href === activeHref;

  /** Main nav active: scroll section or listing area (agent public). */
  const isNavLinkActive = (link) => {
    if (isActiveLink(link.href)) return true;
    if (isAgentPublicSite && link.type && activeType === link.type) return true;
    return false;
  };

  const isHomeLink = (href) => href === homeHref || href === "/";

  const applyListingFilter = ({ type, subtype, hash }) => {
    const params = new URLSearchParams(window.location.search);
    if (type) params.set("type", type);
    else params.delete("type");
    if (subtype) params.set("subtype", subtype);
    else params.delete("subtype");
    const qs = params.toString();
    const nextHash = hash || "";
    const next = `${pathname}${qs ? `?${qs}` : ""}${nextHash}`;
    // Client-side filter only — avoid router.replace so App Router loading.js /
    // NavigationLoader are not triggered on every subtype change.
    window.history.replaceState(window.history.state, "", next);
    setActiveType(normalizePropertyType(type || null));
    setActiveSubtype(normalizePropertySubtype(subtype || null));
    window.dispatchEvent(
      new CustomEvent("dhalahorePropertiesTypeFilter", {
        detail: {
          type: type || null,
          subtype: subtype || null,
        },
      }),
    );
  };

  const handleLogoClick = async (event) => {
    event.preventDefault();
    lockedHrefRef.current = null;
    window.clearTimeout(lockTimerRef.current);
    setMenuOpen(false);
    setActiveSubtype(null);
    setActiveType(null);
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));

    // Agent public site: go to /re/{handle} (no #hero) so the search bar stays in view.
    if (homeHref.startsWith("/re/")) {
      if (pathname !== homeHref) {
        await router.push(homeHref);
      } else {
        if (window.location.hash || window.location.search) {
          window.history.replaceState(null, "", homeHref);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setActiveHref(homeHref);
      return;
    }

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
    setActiveSubtype(null);
    setActiveType(null);
    window.dispatchEvent(new Event("dhalahorePropertiesResetFilters"));

    if (homeHref.startsWith("/re/")) {
      if (pathname !== homeHref) {
        await router.push(homeHref);
      } else {
        if (window.location.hash || window.location.search) {
          window.history.replaceState(null, "", homeHref);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setActiveHref(homeHref);
      return;
    }

    await router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveHref("/");
  };

  const handleSectionClick = (event, href, filter = null) => {
    event.preventDefault();
    setActiveDropdown(null);
    setHoverArmed(false);
    if (typeof document !== "undefined" && document.activeElement?.blur) {
      document.activeElement.blur();
    }

    let scrollTargetId = href.slice(1);
    let nextType = null;
    let nextSubtype = null;

    if (isAgentPublicSite && filter?.type) {
      nextType = filter.type;
      nextSubtype = filter.subtype || null;
      scrollTargetId = listingScrollTargetId(nextType, nextSubtype);
    } else if (isAgentPublicSite) {
      nextType = normalizePropertyType(
        href === "#for-sale"
          ? "sale"
          : href === "#for-rent"
            ? "rent"
            : href === "#plots"
              ? "plot"
              : null,
      );
    }

    const element = document.getElementById(scrollTargetId);
    lockedHrefRef.current = href;
    setActiveHref(href);
    setMenuOpen(false);
    window.clearTimeout(lockTimerRef.current);
    lockTimerRef.current = window.setTimeout(() => {
      lockedHrefRef.current = null;
    }, 1200);

    if (isAgentPublicSite) {
      if (nextType) setActiveType(nextType);
      else setActiveType(null);
      setActiveSubtype(nextSubtype);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (filter?.clear) {
      applyListingFilter({ type: null, subtype: null, hash: href });
    } else if (filter?.type || filter?.subtype) {
      applyListingFilter({
        type: filter.type || null,
        subtype: filter.subtype || null,
        hash: href,
      });
    }

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!filter?.type && !filter?.subtype && !filter?.clear) {
      if (window.location.hash !== href) {
        window.history.pushState(null, "", href);
      }
    }
  };

  const homeLinkHref = homeHref;

  const renderDesktopLink = (link) => {
    const active = isNavLinkActive(link);
    const isHash = link.href.startsWith("#");
    const hasChildren = Array.isArray(link.children) && link.children.length > 0;

    if (!hasChildren) {
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
    }

    const dropdownId = link.type || link.label;
    const dropdownOpen = activeDropdown === dropdownId;

    return (
      <div
        key={link.label}
        className={`${styles.navItem} ${active ? styles.navLinkActive : ""} ${dropdownOpen ? styles.navItemOpen : ""}`.trim()}
        onMouseEnter={() => {
          if (!hoverArmed) return;
          setActiveDropdown(dropdownId);
        }}
        onMouseLeave={() => {
          setHoverArmed(true);
          setActiveDropdown((current) =>
            current === dropdownId ? null : current,
          );
        }}
      >
        <Link
          href={link.href}
          className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`.trim()}
          onClick={(event) =>
            handleSectionClick(event, link.href, {
              clear: true,
              type: link.type,
            })
          }
        >
          {link.label}
        </Link>
        <div className={styles.navDropdown} role="menu">
          <Link
            href={link.href}
            className={`${styles.navDropdownLink} ${activeType === link.type && !activeSubtype ? styles.navDropdownLinkActive : ""}`.trim()}
            role="menuitem"
            tabIndex={dropdownOpen ? 0 : -1}
            aria-current={activeType === link.type && !activeSubtype ? "true" : undefined}
            onClick={(event) =>
              handleSectionClick(event, link.href, {
                type: link.type,
                subtype: null,
              })
            }
          >
            All {link.label.replace(/^For\s+/i, "")}
          </Link>
          {link.children.map((child) => {
            const childHash = isAgentPublicSite
              ? `#${listingScrollTargetId(link.type, child.subtype)}`
              : `#${sectionIdFromType(link.type)}`;
            const childActive =
              activeType === link.type && activeSubtype === child.subtype;
            return (
              <Link
                key={`${link.label}-${child.label}`}
                href={childHash}
                className={`${styles.navDropdownLink} ${childActive ? styles.navDropdownLinkActive : ""}`.trim()}
                role="menuitem"
                tabIndex={dropdownOpen ? 0 : -1}
                aria-current={childActive ? "true" : undefined}
                onClick={(event) =>
                  handleSectionClick(event, childHash, {
                    type: link.type,
                    subtype: child.subtype,
                  })
                }
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMobileLink = (link, index) => {
    const active = isNavLinkActive(link);
    const isHash = link.href.startsWith("#");
    const hasChildren = Array.isArray(link.children) && link.children.length > 0;
    const groupOpen = openMobileGroup === link.label;

    if (!hasChildren) {
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
    }

    return (
      <div
        key={link.label}
        className={styles.mobileGroup}
        style={{ "--stagger": `${index * 50}ms` }}
      >
        <button
          type="button"
          className={`${styles.mobileGroupToggle} ${active ? styles.navLinkActive : ""}`.trim()}
          aria-expanded={groupOpen}
          tabIndex={menuEntered ? 0 : -1}
          onClick={() =>
            setOpenMobileGroup((prev) =>
              prev === link.label ? null : link.label,
            )
          }
        >
          <span>{link.label}</span>
          <span className={styles.mobileChevron} aria-hidden="true">
            {groupOpen ? "▾" : "▸"}
          </span>
        </button>
        {groupOpen ? (
          <div className={styles.mobileSubmenu}>
            <Link
              href={link.href}
              className={`${styles.mobileSubLink} ${activeType === link.type && !activeSubtype ? styles.mobileSubLinkActive : ""}`.trim()}
              tabIndex={menuEntered ? 0 : -1}
              aria-current={activeType === link.type && !activeSubtype ? "true" : undefined}
              onClick={(event) =>
                handleSectionClick(event, link.href, {
                  type: link.type,
                  subtype: null,
                })
              }
            >
              All {link.label.replace(/^For\s+/i, "")}
            </Link>
            {link.children.map((child) => {
              const childHash = isAgentPublicSite
                ? `#${listingScrollTargetId(link.type, child.subtype)}`
                : `#${sectionIdFromType(link.type)}`;
              const childActive =
                activeType === link.type && activeSubtype === child.subtype;
              return (
                <Link
                  key={`${link.label}-${child.label}`}
                  href={childHash}
                  className={`${styles.mobileSubLink} ${childActive ? styles.mobileSubLinkActive : ""}`.trim()}
                  tabIndex={menuEntered ? 0 : -1}
                  aria-current={childActive ? "true" : undefined}
                  onClick={(event) =>
                    handleSectionClick(event, childHash, {
                      type: link.type,
                      subtype: child.subtype,
                    })
                  }
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

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
            href={homeHref.startsWith("/re/") ? homeHref : logoScrollTarget ? `#${logoScrollTarget}` : "/"}
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
            {resolvedNavLinks.map((link) => renderDesktopLink(link))}
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
          {resolvedNavLinks.map((link, index) =>
            renderMobileLink(link, index),
          )}
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
