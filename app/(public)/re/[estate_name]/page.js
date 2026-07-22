import { notFound } from "next/navigation";
import Image from "next/image";
import { getAgentByEstateName, getPropertiesByAgentId } from "@/lib/queries";
import { PropertySection, ContactSection } from "./EstatePageExtras";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const agent = await getAgentByEstateName(params.estate_name);
  if (!agent) return {};
  return {
    title: `${agent.full_name} — Property Listings | Dhalahore Properties`,
    description: `Browse premium properties listed by ${agent.full_name} on Dhalahore Properties.`,
  };
}

export default async function AgentListingsPage({ params }) {
  const agent = await getAgentByEstateName(params.estate_name);
  if (!agent) return notFound();

  const properties = await getPropertiesByAgentId(agent.id);

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderGroup}>
            <Image
              src="/logo.svg"
              alt="Dhalahore Properties"
              width={144}
              height={40}
            />
            <div>
              <p className={styles.pageHeaderTitle}>Lahore estate experts</p>
            </div>
          </div>

          <a href="#contact" className={styles.pageHeaderLink}>
            Contact agent
          </a>
        </header>

        <section className={styles.heroSection}>
          <div className={styles.heroGrid}>
            <div className={styles.heroIntro}>
              <p className={styles.heroEstate}>/re/{agent.estate_name}</p>
              <h1 className={styles.heroTitle}>
                {agent.full_name}&apos;s listings
              </h1>
              <p className={styles.heroText}>
                Explore premium Lahore properties managed by {agent.full_name}.
                Use the filter to find listings fast, then reach out with a
                quick message to book a viewing.
              </p>
            </div>

            <div className={styles.heroPanel}>
              <div className={styles.heroPanelCard}>
                <p className={styles.heroCardLabel}>Estate owner</p>
                <p className={styles.heroCardTitle}>{agent.full_name}</p>
              </div>
              <div className={styles.heroPanelCard}>
                <p className={styles.heroCardLabel}>Contact info</p>
                <p className={styles.heroCardTitle}>
                  <a
                    href={`mailto:${agent.email}`}
                    className={styles.pageHeaderLink}
                  >
                    {agent.email}
                  </a>
                </p>
                <p className={styles.heroCardText}>
                  {agent.phone ? (
                    <a
                      href={`tel:${agent.phone}`}
                      className={styles.pageHeaderLink}
                    >
                      {agent.phone}
                    </a>
                  ) : (
                    "Phone not available"
                  )}
                </p>
              </div>
              <div className={styles.heroPanelCard}>
                <p className={styles.heroCardText}>
                  Book a property visit in Lahore or ask for a bespoke
                  portfolio.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PropertySection
          estateName={agent.estate_name}
          properties={properties}
        />
        <ContactSection agent={agent} />

        <footer className={styles.pageFooter}>
          Dhalahore Properties · Trusted Lahore listings delivered with clarity.
        </footer>
      </div>
    </div>
  );
}
