"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./AgentPortalShell.module.css";

function navItems(base) {
  return [
    {
      href: base,
      label: "Dashboard",
      exact: true,
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
      href: `${base}/properties`,
      label: "Properties",
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
      href: `${base}/properties/create`,
      label: "Add Property",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: `${base}/profile`,
      label: "My Profile",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 19.5c1.8-3.2 4.1-4.8 7-4.8s5.2 1.6 7 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: `${base}/company-branding`,
      label: "Company Branding",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 20V8.5L12 4l8 4.5V20H4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9 20v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];
}

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  if (item.href.endsWith("/properties/create")) {
    return pathname === item.href;
  }
  if (item.href.endsWith("/properties")) {
    return (
      pathname === item.href ||
      (pathname.startsWith(`${item.href}/`) &&
        !pathname.includes("/properties/create"))
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AgentPortalShell({
  children,
  username,
  agentName,
  title,
  subtitle,
  action,
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/re/${encodeURIComponent(username)}/adminarea`;
  const items = useMemo(() => navItems(base), [base]);
  const activeItem = items.find((item) => isActive(pathname, item));

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
            <p className={styles.brandSub}>Agent Portal</p>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Agent portal">
          {items.map((item) => {
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
            href={`/re/${encodeURIComponent(username)}`}
            className={styles.viewSite}
            target="_blank"
            rel="noopener noreferrer"
          >
            View public website
          </Link>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => signOut({ callbackUrl: "/agent/login" })}
          >
            Logout
          </button>
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
              <p className={styles.kicker}>{agentName || "Agent"}</p>
              <h1 className={styles.pageTitle}>
                {title || activeItem?.label || "Dashboard"}
              </h1>
              {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
            </div>
          </div>
          {action ? <div className={styles.topbarAction}>{action}</div> : null}
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
