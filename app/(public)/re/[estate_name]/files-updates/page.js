import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentByUsername } from "@/lib/queries";
import { getPublishedFilesUpdateByAgent } from "@/lib/filesUpdates";
import { agentPublicUsername } from "@/lib/propertySlug";
import SiteHeader from "@/components/SiteHeader";
import { AGENT_PUBLIC_NAV } from "@/components/PublicPropertyWebsite";
import {
  filterNavLinksByPreferences,
  getPropertyViewMode,
  isFilesRatesNavEnabled,
  normalizeWebsiteListingPreferences,
} from "@/lib/websiteListingPreferences";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { agentPhoneEntries } from "@/lib/agentContact";
import { resolveAgentWhatsAppNumber, agentWebsiteWhatsAppMessage } from "@/lib/whatsapp";
import styles from "./page.module.css";
import "@/app/agent-public-theme.css";

export const revalidate = 60;

function buildAgentNavLinks({ agent, agentHomeHref, listingPreferences, includeFilesRates }) {
  const viewMode = getPropertyViewMode(listingPreferences);

  const filteredNav = (() => {
    if (viewMode === "flat") {
      return AGENT_PUBLIC_NAV.filter((item) => !item.type).flatMap((item) =>
        item.label === "Home"
          ? [item, { label: "Properties", href: "#properties" }]
          : [item],
      );
    }
    return filterNavLinksByPreferences(AGENT_PUBLIC_NAV, listingPreferences);
  })();

  const navLinks = filteredNav.map((item) => {
    if (item.label === "Home") return { label: "Home", href: "/" };
    if (item.href.startsWith("#")) {
      return { label: item.label, href: `${agentHomeHref}${item.href}` };
    }
    return { label: item.label, href: item.href };
  });

  if (includeFilesRates) {
    const filesUpdateLink = {
      label: "Files Rates",
      href: `${agentHomeHref}/files-updates`,
    };
    const areasIndex = navLinks.findIndex((item) => item.label === "Search Areas");
    if (areasIndex === -1) {
      navLinks.push(filesUpdateLink);
    } else {
      navLinks.splice(areasIndex, 0, filesUpdateLink);
    }
  }

  return navLinks;
}

export async function generateMetadata({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return {};

  const listingPreferences = normalizeWebsiteListingPreferences(
    agent?.website_listing_preferences,
  );
  if (!isFilesRatesNavEnabled(listingPreferences)) return {};

  const filesUpdate = await getPublishedFilesUpdateByAgent(agent.id);
  if (!filesUpdate) {
    return {
      title: `Files Rates | ${agent.full_name} — Dhalahore Properties`,
      description: `File prices and market updates from ${agent.full_name}.`,
    };
  }
  return {
    title: `${filesUpdate.title} | ${agent.full_name} — Dhalahore Properties`,
    description: `Latest file prices and market updates from ${agent.full_name}.`,
  };
}

export default async function FilesUpdatesPage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const listingPreferences = normalizeWebsiteListingPreferences(
    agent?.website_listing_preferences,
  );
  if (!isFilesRatesNavEnabled(listingPreferences)) return notFound();

  const filesUpdate = await getPublishedFilesUpdateByAgent(agent.id);

  const agentHandle = agentPublicUsername(agent);
  const agentHomeHref = `/re/${encodeURIComponent(agentHandle)}`;
  const navLinks = buildAgentNavLinks({
    agent,
    agentHomeHref,
    listingPreferences,
    includeFilesRates: true,
  });

  const phoneEntries = agent ? agentPhoneEntries(agent) : [];
  const waNumber = agent ? resolveAgentWhatsAppNumber(agent) : null;
  const waMessage = agent ? agentWebsiteWhatsAppMessage(agent) : "";
  const waFabPhone = waNumber ? waNumber : null;
  const waFabMessage = waMessage || "I'd like to know more about your services.";

  const companyName =
    agent.company_name && String(agent.company_name).trim()
      ? String(agent.company_name).trim()
      : agent.estate_name || "Agency";

  const lastUpdated = filesUpdate
    ? new Date(filesUpdate.updated_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className={`agent-public-theme ${styles.wrapper}`}>
      <SiteHeader
        navLinks={navLinks}
        ctaLabel="Contact"
        ctaHref={`${agentHomeHref}#contact`}
        logoSrc={agent.company_logo || "/logo.svg"}
        logoAlt={agent.company_logo ? `${companyName} logo` : "Dhalahore Properties"}
      />

      <main className={styles.main}>
        <article className={styles.article}>
          <Link href={agentHomeHref} className={styles.backLink}>
            ← Back to home
          </Link>

          {filesUpdate ? (
            <>
              <header className={styles.header}>
                <p className={styles.kicker}>Market Update</p>
                <h1 className={styles.title}>{filesUpdate.title}</h1>
                <div className={styles.meta}>
                  <span className={styles.author}>
                    By {agent.full_name || companyName}
                  </span>
                  <span className={styles.dot} aria-hidden="true">·</span>
                  <span className={styles.lastUpdated}>
                    Last Updated: {lastUpdated}
                  </span>
                </div>
              </header>

              {filesUpdate.content ? (
                <div
                  className={styles.content}
                  dangerouslySetInnerHTML={{ __html: filesUpdate.content }}
                />
              ) : (
                <p className={styles.empty}>This update has no content yet.</p>
              )}
            </>
          ) : (
            <header className={styles.header}>
              <p className={styles.kicker}>Market Update</p>
              <h1 className={styles.title}>Files Rates</h1>
              <p className={styles.empty}>Files rates are not available yet.</p>
            </header>
          )}

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <p className={styles.contactKicker}>Contact</p>
              <h2 className={styles.contactHeading}>
                Interested in working with {agent.full_name || companyName}?
              </h2>
              <p className={styles.contactCopy}>
                Reach out for buying, selling, or investment guidance.
              </p>
              <div className={styles.contactActions}>
                {phoneEntries.length > 0 ? (
                  <a
                    href={phoneEntries[0].href}
                    className={styles.contactButton}
                  >
                    Call {phoneEntries[0].number}
                  </a>
                ) : null}
                <Link href={agentHomeHref} className={styles.contactButtonGhost}>
                  View Listings
                </Link>
              </div>
            </div>
          </section>
        </article>
      </main>

      <AgentWhatsAppFab phone={waFabPhone} message={waFabMessage} />
    </div>
  );
}
