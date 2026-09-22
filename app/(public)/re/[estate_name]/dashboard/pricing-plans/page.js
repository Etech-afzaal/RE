"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "Free",
    badge: "Current Plan",
    features: [
      "Agent public website",
      "Property listings",
      "Basic profile",
      "Customer inquiries",
    ],
    buttonLabel: "Current Plan",
    disabled: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "Coming Soon",
    badge: null,
    features: [
      "More visibility",
      "Marketing tools",
      "More listings",
      "Advanced features",
    ],
    buttonLabel: "Available Soon",
    disabled: true,
  },
  {
    id: "professional",
    name: "Professional",
    price: "Coming Soon",
    badge: null,
    features: [
      "Premium visibility",
      "Advanced marketing",
      "Business growth tools",
      "Future premium features",
    ],
    buttonLabel: "Available Soon",
    disabled: true,
  },
];

export default function PricingPlansPage() {
  const params = useParams();
  const router = useRouter();
  const { status } = useSession();
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
        title="Pricing & Plans"
        subtitle="Choose the plan that fits your real estate business."
      >
        <p className={styles.loading}>Loading…</p>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      title="Pricing & Plans"
      subtitle="Choose the plan that fits your real estate business."
    >
      <div className={styles.page}>
        <section className={styles.currentPlan}>
          <p className={styles.currentKicker}>Current Plan</p>
          <div className={styles.currentBody}>
            <div className={styles.currentInfo}>
              <h2 className={styles.currentName}>FREE PLAN</h2>
              <span className={styles.currentStatus}>✓ Active</span>
            </div>
            <div className={styles.currentDuration}>
              <p className={styles.durationLabel}>Duration</p>
              <p className={styles.durationValue}>1 Year</p>
            </div>
          </div>
        </section>

        <div className={styles.cards}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`${styles.card} ${plan.id === "free" ? styles.cardCurrent : ""}`}
            >
              {plan.badge ? (
                <span className={styles.badge}>{plan.badge}</span>
              ) : null}
              <h3 className={styles.cardName}>{plan.name}</h3>
              <p className={styles.cardPrice}>{plan.price}</p>
              <ul className={styles.featureList}>
                {plan.features.map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    <span className={styles.featureCheck} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M5 12.5 10 17.5 19 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${ui.btnPrimary} ${styles.cardButton}`}
                disabled={plan.disabled}
              >
                {plan.buttonLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AgentPortalShell>
  );
}
