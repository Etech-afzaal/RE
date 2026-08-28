"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, Copy, Link2 } from "lucide-react";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./PropertyLinksModal.module.css";

function fullUrl(path) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export default function PropertyLinksModal({
  property,
  username,
  onClose,
}) {
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/properties/${property.id}/marketing-links`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not load property links.");
        }
        if (active) {
          setLinks(Array.isArray(data.links) ? data.links : []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load property links.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [property.id]);

  async function copyLink(link) {
    const url = fullUrl(link.url);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(link.unique_code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setError("Could not copy link. Please copy manually.");
    }
  }

  return (
    <div className={ui.dialogBackdrop} role="presentation" onClick={onClose}>
      <div
        className={`${ui.dialog} ${styles.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-links-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="property-links-title" className={ui.dialogTitle}>
          Property Links
        </h2>
        <p className={ui.dialogText}>
          Marketing links for &ldquo;{property.title}&rdquo;. Your own site link
          tracks visitors from your public listing; subagent links add referral
          tracking.
        </p>

        <div className={styles.linkContent}>
        {error ? <p className={ui.error}>{error}</p> : null}

        {loading ? (
          <p className={ui.empty}>Loading links…</p>
        ) : error ? null : links.length === 0 ? (
          <div className={styles.emptyState}>
            <Link2 size={20} aria-hidden="true" />
            <p>Could not load links for this property.</p>
          </div>
        ) : (
          <ul className={styles.linkList}>
            {links.map((link) => (
              <li
                key={link.id}
                className={`${styles.linkRow} ${link.is_agent_own ? styles.linkRowOwn : ""}`}
              >
                <div className={styles.linkPerson}>
                  {link.subagent.image ? (
                    <Image
                      src={link.subagent.image}
                      alt=""
                      width={44}
                      height={44}
                      className={styles.linkAvatar}
                    />
                  ) : (
                    <div className={styles.linkAvatarFallback}>
                      {link.subagent.name?.charAt(0) || "Y"}
                    </div>
                  )}
                  <div>
                    <p className={styles.linkName}>
                      {link.subagent.name}
                      {link.is_agent_own ? (
                        <span className={styles.ownBadge}>Your site</span>
                      ) : null}
                    </p>
                    <p className={styles.linkCode}>
                      {link.is_agent_own
                        ? "Direct listing on your website"
                        : `ref=${link.unique_code}`}
                    </p>
                  </div>
                </div>
                <Link
                  href={`${base}/properties/${property.id}/links/${link.id}/insights`}
                  className={`${ui.btnPrimary} ${styles.insightsButton}`}
                  onClick={onClose}
                >
                  <BarChart3 size={16} aria-hidden="true" />
                  Insights
                </Link>
                <div className={styles.linkUrlRow}>
                  <p className={styles.linkUrl}>{fullUrl(link.url)}</p>
                  <button
                    type="button"
                    className={`${ui.btnGhost} ${styles.copyLinkButton}`}
                    onClick={() => copyLink(link)}
                    aria-label={
                      copiedCode === link.unique_code ? "Link copied" : "Copy link"
                    }
                    title={
                      copiedCode === link.unique_code ? "Link copied" : "Copy link"
                    }
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>

        <div className={ui.dialogActions}>
          <button type="button" className={ui.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
