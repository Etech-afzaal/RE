"use client";

import { useState } from "react";
import { useCompactDashboardHeader } from "@/lib/useCompactDashboardHeader";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { signOut } from "next-auth/react";
import LogoutButton from "@/components/LogoutButton";
import {
  SidebarTooltip,
  useSidebarTooltip,
} from "@/components/SidebarTooltip";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import styles from "./AdminShell.module.css";

const NAV = [
  {
    href: "/admin/dashboard",
    label: "Overview",
    exact: true,
    subtitle: "Platform performance and items that need your attention.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/requests",
    label: "Agent Requests",
    subtitle: "Approve, reject, revoke, or re-grant agent access requests.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 4h10a2 2 0 0 1 2 2v14l-3.5-2.2L12 20l-3.5-2.2L5 20V6a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/agents",
    label: "Agents",
    subtitle: "Review active estates and enable or disable agent accounts.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M16 19v-1.2A3.8 3.8 0 0 0 12.2 14H7.8A3.8 3.8 0 0 0 4 17.8V19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="10" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M20 19v-1a3 3 0 0 0-2.1-2.9M15.5 5.2a3 3 0 0 1 0 5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/approvals",
    label: "Property Approvals",
    subtitle: "Review listings agents submitted and approve or reject them.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.5 4.5 6.8V12c0 4.4 3.1 7.6 7.5 8.6 4.4-1 7.5-4.2 7.5-8.6V6.8L12 3.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m9 12 2.2 2.2L15.5 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/properties",
    label: "Properties",
    subtitle: "Oversee listings across estates — publish, unpublish, or review status changes.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 21v-7h6v7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/ads",
    label: "Ads",
    subtitle: "Paid/featured ads serve first; free ads fill slots when no paid ad is live.",
    // Primary button shown in the top bar on the section's main page only.
    action: { href: "/admin/dashboard/ads/new", label: "New ad" },
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/ad-formats",
    label: "Ad Formats",
    subtitle: "Sizes the site can request ads in, and how often each slot is filled.",
    // ?new=1 opens the "New format" dialog on the page.
    action: { href: "/admin/dashboard/ad-formats?new=1", label: "New format" },
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4" width="17" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3.5" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13.5" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard/logs",
    label: "Logs",
    subtitle: "Audit trail of important actions across the platform.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 4h10a2 2 0 0 1 2 2v14l-3.5-2.2L12 20l-3.5-2.2L5 20V6a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 9h6M9 13h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function CollapseIcon({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {collapsed ? (
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M15 6l-6 6 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { headerRef, compact, spacerHeight } = useCompactDashboardHeader();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed(
    "admin.sidebarCollapsed",
  );
  const { tip, tipHandlers, hideTooltip } = useSidebarTooltip(collapsed);

  const activeItem = NAV.find((item) => isActive(pathname, item));
  const pageTitle = activeItem?.label || "Admin";
  const pageSubtitle = activeItem?.subtitle || "";
  const pageAction = activeItem?.action && pathname === activeItem.href ? activeItem.action : null;

  return (
    <div className={styles.shell}>
      {open ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""} ${
          collapsed ? styles.sidebarCollapsed : ""
        }`}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>D</span>
          <div className={styles.brandText}>
            <p className={styles.brandName}>Dhalahore</p>
            <p className={styles.brandSub}>Admin Console</p>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
            {...tipHandlers(
              collapsed ? "Expand sidebar" : "Collapse sidebar",
            )}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Admin">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                onClick={() => {
                  hideTooltip();
                  setOpen(false);
                }}
                {...tipHandlers(item.label)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link
            href="/"
            className={styles.viewSite}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              hideTooltip();
              setOpen(false);
            }}
            {...tipHandlers("View public site")}
          >
            <span className={styles.footerIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M14 5h5v5M19 5l-9 9M10 5H5v14h14v-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={styles.footerLabel}>View public site</span>
          </Link>
          {collapsed ? (
            <button
              type="button"
              className={styles.logoutBtn}
              aria-label="Logout"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              {...tipHandlers("Logout")}
            >
              <span className={styles.footerIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M10 7V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-2M15 12H4m0 0 3-3M4 12l3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          ) : (
            <LogoutButton
              callbackUrl="/admin/login"
              label="Logout"
              className={styles.logoutBtn}
            />
          )}
        </div>
      </aside>

      <SidebarTooltip tip={tip} />

      <div className={styles.main}>
        <header ref={headerRef} className={`${styles.topbar} ${compact ? styles.topbarCompact : ""}`}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={`${styles.menuBtn} ${open ? styles.menuBtnOpen : ""}`}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((isOpen) => !isOpen)}
            >
              {open ? (
                <svg
                  width="20"
                  height="20"
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
                  width="20"
                  height="20"
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
            <div>
              <p className={styles.kicker}>Super Admin dashboard</p>
              <h1 className={styles.pageTitle}>{pageTitle}</h1>
              {pageSubtitle ? (
                <p className={styles.pageSubtitle}>{pageSubtitle}</p>
              ) : null}
            </div>
          </div>
          {pageAction ? (
            <Link href={pageAction.href} className={styles.topbarAction}>
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              {pageAction.label}
            </Link>
          ) : null}
          <div className={styles.topbarRight}>
            <span className={styles.rolePill}>Superadmin</span>
          </div>
        </header>
        <div aria-hidden="true" style={{ height: spacerHeight, flexShrink: 0 }} />

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
