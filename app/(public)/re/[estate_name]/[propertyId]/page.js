import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import GalleryCarousel from "./GalleryCarousel";
import { getAgentByEstateName, getPropertyById } from "@/lib/queries";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";

const formatPrice = (price) =>
  price ? `PKR ${Number(price).toLocaleString()}` : "Price on request";

const formatSize = (value, unit) => {
  if (value == null || value === "") return null;
  const num = Number(value);
  const formatted = Number.isFinite(num)
    ? Number.isInteger(num)
      ? String(num)
      : String(num)
    : String(value);
  return `${formatted} ${unit || ""}`.trim();
};

export default async function PropertyDetailPage({ params }) {
  const agent = await getAgentByEstateName(params.estate_name);
  if (!agent) return notFound();

  const property = await getPropertyById(Number(params.propertyId));
  if (!property || property.agent_id !== agent.id) return notFound();

  const sizeLabel = formatSize(property.size_value, property.size_unit);
  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "draft"
        ? "Draft"
        : "For Sale";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <BackButton
              fallbackHref={`/re/${params.estate_name}`}
              label="← Back"
              className={styles.backBtn}
            />
            <Link href="/" className={styles.logoLink}>
              <Image
                src="/logo.svg"
                alt="Dhalahore Properties"
                width={110}
                height={40}
              />
            </Link>
          </div>
          <div className={styles.headerActions}>
            <a href={`mailto:${agent.email}`} className={styles.contactButton}>
              Contact agent
            </a>
          </div>
        </header>

        <section className={styles.heroFacts}>
          <div className={styles.heroMain}>
            <div className={styles.badges}>
              <span className={styles.statusBadge}>{statusLabel}</span>
              {property.location ? (
                <span className={styles.locationBadge}>{property.location}</span>
              ) : null}
            </div>
            <h1 className={styles.title}>{property.title}</h1>
            <p className={styles.price}>{formatPrice(property.price)}</p>

            <div className={styles.factRow}>
              {sizeLabel ? (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Size</span>
                  <strong>{sizeLabel}</strong>
                </div>
              ) : null}
              <div className={styles.fact}>
                <span className={styles.factLabel}>Location</span>
                <strong>{property.location || "Not specified"}</strong>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Listed by</span>
                <strong>{agent.full_name}</strong>
              </div>
            </div>

            {property.description ? (
              <div className={styles.description}>
                <h2>About this property</h2>
                <p>{property.description}</p>
              </div>
            ) : null}
          </div>

          <aside className={styles.agentCard}>
            <p className={styles.agentKicker}>Agent contact</p>
            <h2 className={styles.agentName}>{agent.full_name}</h2>
            <p className={styles.agentRole}>Estate agent · {agent.estate_name}</p>

            <div className={styles.agentDetails}>
              <a href={`mailto:${agent.email}`} className={styles.agentDetail}>
                <span>Email</span>
                <strong>{agent.email}</strong>
              </a>
              <a
                href={
                  agent.phone
                    ? `tel:${agent.phone.replace(/\s/g, "")}`
                    : undefined
                }
                className={styles.agentDetail}
              >
                <span>Phone</span>
                <strong>{agent.phone || "Not available"}</strong>
              </a>
            </div>

            <div className={styles.agentActions}>
              <a href={`mailto:${agent.email}`} className={styles.agentPrimary}>
                Email agent
              </a>
            </div>
          </aside>
        </section>

        <GalleryCarousel
          images={property.images}
          title={property.title}
          featuredImage={property.featuredImage}
        />

        <section className={styles.videoSection}>
          <p className={styles.sectionKicker}>Video tour</p>
          <h2 className={styles.sectionTitle}>Walkthrough coming soon</h2>
          <div className={styles.videoPlaceholder}>
            <div className={styles.videoIcon}>▶</div>
            <p className={styles.videoText}>Video preview unavailable yet</p>
            <p className={styles.videoSubtext}>
              Browse the gallery above, or contact the agent to schedule a
              viewing.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
