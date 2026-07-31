"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
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
    subtitle: "Oversee listings across estates — publish, unpublish, or mark sold.",
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
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeItem = NAV.find((item) => isActive(pathname, item));
  const pageTitle = activeItem?.label || "Admin";
  const pageSubtitle = activeItem?.subtitle || "";

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

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>D</span>
          <div>
            <p className={styles.brandName}>Dhalahore</p>
            <p className={styles.brandSub}>Admin Console</p>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Admin">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
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
            onClick={() => setOpen(false)}
          >
            View public site
          </Link>
          <LogoutButton
            callbackUrl="/admin/login"
            label="Logout"
            className={styles.logoutBtn}
          />
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.menuBtn}
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className={styles.kicker}>Super Admin dashboard</p>
              <h1 className={styles.pageTitle}>{pageTitle}</h1>
              {pageSubtitle ? (
                <p className={styles.pageSubtitle}>{pageSubtitle}</p>
              ) : null}
            </div>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.rolePill}>Superadmin</span>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
