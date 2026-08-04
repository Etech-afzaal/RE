import Image from "next/image";
import AgentAvatar from "@/components/AgentAvatar";
import { agentPublicUsername } from "@/lib/propertySlug";
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

function companyInitials(companyName) {
  const words = String(companyName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "RE";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
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

export default function AgentBrandProfile({ agent }) {
  if (!agent) return null;

  const companyName = companyNameFromAgent(agent);
  const designation = agentDesignation(agent);
  const areas = parseAreas(agent.areas_served);
  const phoneHref = agent.phone
    ? `tel:${String(agent.phone).replace(/\s/g, "")}`
    : null;

  return (
    <section
      id="agent"
      className={styles.section}
      aria-label={`${agent.full_name} brand profile`}
    >
      <div className={styles.card}>
        <div className={styles.companyBlock}>
          <div className={styles.logoWrap}>
            {agent.company_logo ? (
              <Image
                src={agent.company_logo}
                alt={`${companyName} logo`}
                width={169}
                height={47}
                className={styles.logoImage}
              />
            ) : (
              <div className={styles.logoFallback} aria-hidden="true">
                {companyInitials(companyName)}
              </div>
            )}
          </div>
          <h2 className={styles.companyName}>{companyName}</h2>
          <p className={styles.companyRole}>Real Estate Consultant</p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.agentBlock}>
          <AgentAvatar
            src={agent.profile_image}
            alt=""
            width={72}
            height={72}
            className={styles.agentPhoto}
          />
          <div className={styles.agentCopy}>
            <h3 className={styles.agentName}>{agent.full_name}</h3>
            <p className={styles.agentRole}>{designation}</p>
          </div>
        </div>

        {agent.description ? (
          <>
            <div className={styles.divider} aria-hidden="true" />
            <div className={styles.block}>
              <p className={styles.blockLabel}>About Company</p>
              <p className={styles.aboutText}>{agent.description}</p>
            </div>
          </>
        ) : null}

        {areas.length > 0 ? (
          <>
            <div className={styles.divider} aria-hidden="true" />
            <div className={styles.block}>
              <p className={styles.blockLabel}>Areas Served</p>
              <ul className={styles.areaList}>
                {areas.map((area) => (
                  <li key={area} className={styles.areaChip}>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {(agent.phone || agent.email) && (
          <>
            <div className={styles.divider} aria-hidden="true" />
            <div className={styles.block}>
              <p className={styles.blockLabel}>Contact Information</p>
              <div className={styles.contactGrid}>
                {agent.phone ? (
                  <div className={styles.contactItem}>
                    <span className={styles.contactLabel}>Phone</span>
                    <a href={phoneHref} className={styles.contactValue}>
                      {agent.phone}
                    </a>
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
          </>
        )}

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.verified}>
          <span className={styles.verifiedIcon} aria-hidden="true">
            ✓
          </span>
          <span>Verified Agent</span>
        </div>
      </div>
    </section>
  );
}
