import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentByUsername } from "@/lib/queries";
import { getPublishedFilesUpdateByAgent } from "@/lib/filesUpdates";
import { agentPublicUsername } from "@/lib/propertySlug";
import SiteHeader from "@/components/SiteHeader";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { agentPhoneEntries } from "@/lib/agentContact";
import { resolveAgentWhatsAppNumber, agentWebsiteWhatsAppMessage } from "@/lib/whatsapp";
import styles from "./page.module.css";
import "@/app/agent-public-theme.css";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return {};
  const filesUpdate = await getPublishedFilesUpdateByAgent(agent.id);
  if (!filesUpdate) return {};
  return {
    title: `${filesUpdate.title} | ${agent.full_name} — Dhalahore Properties`,
    description: `Latest file prices and market updates from ${agent.full_name}.`,
  };
}

export default async function FilesUpdatesPage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const filesUpdate = await getPublishedFilesUpdateByAgent(agent.id);
  if (!filesUpdate) return notFound();

  const agentHandle = agentPublicUsername(agent);
  const agentHomeHref = `/re/${encodeURIComponent(agentHandle)}`;

  const phoneEntries = agent ? agentPhoneEntries(agent) : [];
  const waNumber = agent ? resolveAgentWhatsAppNumber(agent) : null;
  const waMessage = agent ? agentWebsiteWhatsAppMessage(agent) : "";
  const waFabPhone = waNumber ? waNumber : null;
  const waFabMessage = waMessage || "I'd like to know more about your services.";

  const companyName =
    agent.company_name && String(agent.company_name).trim()
      ? String(agent.company_name).trim()
      : agent.estate_name || "Agency";

  const lastUpdated = new Date(filesUpdate.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={`agent-public-theme ${styles.wrapper}`}>
      <SiteHeader
        navLinks={[
          { label: "Home", href: agentHomeHref },
          { label: "Files Updates", href: `/re/${encodeURIComponent(agentHandle)}/files-updates` },
        ]}
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
