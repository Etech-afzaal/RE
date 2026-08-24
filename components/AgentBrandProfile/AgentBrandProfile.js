"use client";

import { useEffect } from "react";
import AgentAvatar from "@/components/AgentAvatar";
import { agentPublicUsername } from "@/lib/propertySlug";
import { agentPhoneEntries, agentHasPhone } from "@/lib/agentContact";
import { buildAgentWhatsAppUrl } from "@/lib/whatsapp";
import styles from "./AgentBrandProfile.module.css";

function titleCaseWords(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function companyNameFromAgent(agent) {
  if (agent.company_name && String(agent.company_name).trim()) {
    return String(agent.company_name).trim();
  }
  const base = titleCaseWords(agentPublicUsername(agent) || agent.estate_name);
  if (!base) return "Agency Properties";
  if (/propert/i.test(base)) return base;
  return `${base} Properties`;
}

function agentDesignation(agent) {
  const areas = String(agent.areas_served || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (areas[0]) return `${areas[0]} Property Specialist`;
  return "Real Estate Consultant";
}

function parseAreas(areasServed) {
  return String(areasServed || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function IconProjects() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSold() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6.5v5c0 4.5 3.6 8.5 7 9 3.4-.5 7-4.5 7-9v-5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconListings() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5V20h16V10.5L12 4l-8 6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 20V13h7v7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAreas() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function AgentBrandProfile({ agent, stats = null }) {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#agent") {
      return;
    }
    const target = document.getElementById("agent");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!agent) return null;

  const companyName = companyNameFromAgent(agent);
  const designation = agentDesignation(agent);
  const areas = parseAreas(agent.areas_served);
  const phoneEntries = agentPhoneEntries(agent);
  const whatsappNumber = String(agent.whatsapp_number || "").trim();
  const whatsappHref = buildAgentWhatsAppUrl(agent);

  const brandStats = [
    {
      key: "projects",
      label: "Total Projects",
      value: Number(stats?.totalProjects) || 0,
      icon: <IconProjects />,
    },
    {
      key: "sold",
      label: "Total Sold",
      value: Number(stats?.sold) || 0,
      icon: <IconSold />,
    },
    {
      key: "active",
      label: "Active Listings",
      value: Number(stats?.activeListings) || 0,
      icon: <IconListings />,
    },
    {
      key: "areas",
      label: "Areas Covered",
      value: Number(stats?.areas) || areas.length || 0,
      icon: <IconAreas />,
    },
  ];

  return (
    <section
      id="agent"
      className={styles.section}
      aria-label={`${agent.full_name} brand profile`}
    >
      <div className={styles.card}>
        <div className={styles.companyBlock}>
          <h2 className={styles.companyName}>{companyName}</h2>
          <p className={styles.companyRole}>Real Estate Consultant</p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.profileGrid}>
          <div className={styles.profileMain}>
            <div className={styles.agentIdentity}>
              <AgentAvatar
                src={agent.profile_image}
                alt=""
                width={84}
                height={84}
                className={styles.agentPhoto}
              />
              <div className={styles.agentCopy}>
                <div className={styles.agentNameRow}>
                  <h3 className={styles.agentName}>{agent.full_name}</h3>
                  <span className={styles.verifiedBadge} title="Verified Agent">
                    <span className={styles.verifiedIcon} aria-hidden="true">
                      ✓
                    </span>
                    <span className={styles.verifiedText}>Verified Agent</span>
                  </span>
                </div>
                <p className={styles.agentRole}>{designation}</p>
              </div>
            </div>

            {agent.description ? (
              <div className={styles.block}>
                <p className={styles.blockLabel}>About Company</p>
                <p className={styles.aboutText}>{agent.description}</p>
              </div>
            ) : null}

            {areas.length > 0 ? (
              <div className={styles.block}>
                <p className={styles.blockLabel}>Areas Served</p>
                <ul className={styles.areaList}>
                  {areas.map((area) => (
                    <li key={area}>
                      <a
                        href="#sale"
                        data-location={area}
                        className={styles.areaChip}
                      >
                        {area}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(agentHasPhone(agent) || whatsappNumber || agent.email) && (
              <div className={styles.block}>
                <p className={styles.blockLabel}>Contact Information</p>
                <div className={styles.contactGrid}>
                  {phoneEntries.length > 0 ? (
                    <div className={styles.contactItem}>
                      <span className={styles.contactLabel}>Phone</span>
                      {phoneEntries.map((entry) => (
                        <a
                          key={entry.number}
                          href={entry.href}
                          className={styles.contactValue}
                        >
                          {entry.number}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {whatsappNumber ? (
                    <div className={styles.contactItem}>
                      <span className={styles.contactLabel}>WhatsApp</span>
                      {whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.contactValue}
                        >
                          {whatsappNumber}
                        </a>
                      ) : (
                        <span className={styles.contactValue}>
                          {whatsappNumber}
                        </span>
                      )}
                    </div>
                  ) : null}
                  {agent.email ? (
                    <div className={styles.contactItem}>
                      <span className={styles.contactLabel}>Email</span>
                      <a
                        href={`mailto:${agent.email}`}
                        className={styles.contactValue}
                      >
                        {agent.email}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <ul className={styles.statsColumn} aria-label="Agent stats">
            {brandStats.map((stat) => (
              <li key={stat.key} className={styles.statRow}>
                <span className={styles.statIcon}>{stat.icon}</span>
                <span className={styles.statCopy}>
                  <strong className={styles.statValue}>{stat.value}</strong>
                  <span className={styles.statLabel}>{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
