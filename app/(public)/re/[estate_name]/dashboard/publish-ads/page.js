"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import styles from "./page.module.css";

export default function PublishAdsPage() {
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
        title="Publish Ads"
        subtitle="Promote your listings with paid advertising."
      >
        <p className={styles.loading}>Loading…</p>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Publish Ads"
      subtitle="Promote your listings with paid advertising."
    >
      <section className={styles.card} aria-labelledby="publish-ads-coming-soon">
        <div className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M7 9.5h6M7 12.5h10M7 15.5h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className={styles.kicker}>Coming Soon</p>
        <h2 id="publish-ads-coming-soon" className={styles.title}>
          Publish Ads is coming soon
        </h2>
        <p className={styles.copy}>
          This feature will be available soon. You will be able to publish and
          manage ads to promote your listings and reach more buyers and renters
          from your dashboard.
        </p>
      </section>
    </AgentPortalShell>
  );
}
