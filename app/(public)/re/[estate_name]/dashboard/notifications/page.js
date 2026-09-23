"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import styles from "./page.module.css";

export default function NotificationsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <AgentPortalShell
        username={username}
        title="Notifications"
        subtitle="Stay updated on your listings and inquiries."
      >
        <p className={styles.loading}>Loading…</p>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Notifications"
      subtitle="Stay updated on your listings and inquiries."
    >
      <section className={styles.card} aria-labelledby="notifications-coming-soon">
        <div className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path
              d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.5 1.5 5.5H5s1.5-1.3 1.5-5.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M10 18.5a2 2 0 0 0 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className={styles.kicker}>Coming Soon</p>
        <h2 id="notifications-coming-soon" className={styles.title}>
          Notifications are coming soon
        </h2>
        <p className={styles.copy}>
          This feature will be available soon. You will get updates about new
          inquiries, listing activity, and important account alerts right here
          in your dashboard.
        </p>
      </section>
    </AgentPortalShell>
  );
}
