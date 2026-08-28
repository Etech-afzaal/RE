"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

export default function PropertyLinkInsightsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const propertyId = params.id;
  const linkId = params.linkId;
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/agent/marketing-links/${linkId}/insights`,
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Could not load insights.");
        }
        setData(json);
      } catch (err) {
        setError(err.message || "Could not load insights.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, router, linkId]);

  const link = data?.link;
  const insights = data?.insights;

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Link Insights"
      subtitle={link?.property_title || "Marketing link performance"}
    >
      {loading ? (
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Fetching insights…"
        />
      ) : error ? (
        <p className={ui.error}>{error}</p>
      ) : link ? (
        <div className={`${ui.panel} ${styles.panel}`}>
          <div className={styles.panelBody}>
          <div className={styles.header}>
            {link.subagent?.image ? (
              <Image
                src={link.subagent.image}
                alt=""
                width={56}
                height={56}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarFallback}>
                {link.subagent?.name?.charAt(0) || "S"}
              </div>
            )}
            <div>
              <h2 className={styles.name}>{link.subagent?.name}</h2>
              <p className={styles.meta}>
                {link.is_agent_own
                  ? "Insights from your public listing"
                  : "Marketing link:"}{" "}
                {!link.is_agent_own ? (
                  <strong>{link.unique_code}</strong>
                ) : null}
              </p>
              {!link.is_agent_own && !link.subagent?.is_active ? (
                <p className={styles.archived}>Subagent archived</p>
              ) : null}
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Views</p>
              <p className={styles.statValue}>{insights?.page_view ?? 0}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Phone Reveals</p>
              <p className={styles.statValue}>{insights?.phone_click ?? 0}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>WhatsApp Clicks</p>
              <p className={styles.statValue}>
                {insights?.whatsapp_click ?? 0}
              </p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Emails</p>
              <p className={styles.statValue}>{insights?.email_sent ?? 0}</p>
            </div>
          </div>

          <div className={`${ui.dialogActions} ${styles.actions}`}>
            <Link
              href={`${base}/properties`}
              className={ui.btnGhost}
            >
              Back to Properties
            </Link>
            <Link
              href={`${base}/subagents`}
              className={ui.btnPrimary}
            >
              Manage Subagents
            </Link>
          </div>
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
