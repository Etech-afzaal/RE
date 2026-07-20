import { notFound } from "next/navigation";
import Image from "next/image";
import GalleryCarousel from "./GalleryCarousel";
import { getAgentByEstateName, getPropertyById } from "@/lib/queries";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";

export default async function PropertyDetailPage({ params }) {
  const agent = await getAgentByEstateName(params.estate_name);
  if (!agent) return notFound();

  const property = await getPropertyById(Number(params.propertyId));
  if (!property || property.agent_id !== agent.id) return notFound();

  return (
    <div className={styles.pageWrapper}>
      <div style={{ marginBottom: 12 }}>
        <BackButton
          fallbackHref={`/re/${params.estate_name}`}
          label="← Back"
          style={{
            border: "none",
            background: "transparent",
            color: "#2563eb",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        />
      </div>
      <header className={styles.pageHeader}>
        <div className={styles.headerGroup}>
          <Image
            src="/logo.svg"
            alt="Dhalahore Properties"
            width={110}
            height={40}
          />
          <div>
            <p className={styles.pageHeaderTitle}>Lahore estate experts</p>
          </div>
        </div>

        <a href={`mailto:${agent.email}`} className={styles.contactButton}>
          Contact agent
        </a>
      </header>

      <section className={styles.overviewSection}>
        <div className={styles.overviewGrid}>
          <div>
            <p className={styles.overviewLabel}>Property overview</p>
            <div className={styles.overviewBox}>
              <div>
                <p className={styles.overviewLabel}>Location</p>
                <p className={styles.overviewValue}>
                  {property.location || "Location not specified"}
                </p>
              </div>

              <div>
                <p className={styles.overviewLabel}>Size & budget</p>
                <p className={styles.overviewValue}>
                  {property.size_value
                    ? `${property.size_value} ${property.size_unit}`
                    : "TBD"}
                </p>
              </div>

              <div>
                <p className={styles.overviewLabel}>Price</p>
                <p className={styles.overviewValue}>
                  {property.price
                    ? `PKR ${Number(property.price).toLocaleString()}`
                    : "Contact for price"}
                </p>
              </div>
            </div>
          </div>

          <div className={styles.agentPanel}>
            <p className={styles.overviewLabel}>Agent contact</p>
            <h2 className={styles.agentName}>{agent.full_name}</h2>
            <p className={styles.agentText}>
              {agent.position || "Estate agent"}
            </p>

            <div className={styles.agentMeta}>
              <div className={styles.agentStat}>
                <p className={styles.agentStatLabel}>Email</p>
                <p className={styles.agentStatValue}>{agent.email}</p>
              </div>
              <div className={styles.agentStat}>
                <p className={styles.agentStatLabel}>Phone</p>
                <p className={styles.agentStatValue}>
                  {agent.phone || "Not available"}
                </p>
              </div>
            </div>

            <p className={styles.agentText}>
              This page gives you a quick overview, a photo slider, and a video
              section is coming soon.
            </p>
          </div>
        </div>
      </section>

      <GalleryCarousel
        images={property.images}
        title={property.title}
        featuredImage={property.featuredImage}
      />

      <section className={styles.videoSection}>
        <div className={styles.galleryHeader}>
          <p className={styles.videoBadge}>Video tour</p>
          <div>
            <h2 className={styles.videoTitle}>Video walkthrough coming soon</h2>
          </div>
        </div>

        <div className={styles.videoPlaceholder}>
          <div className={styles.videoBackdrop} />
          <div className={styles.videoCard}>
            <div className={styles.videoIcon}>
              <span className={styles.videoIconText}>▶</span>
            </div>
            <p className={styles.videoText}>Video section placeholder</p>
            <p className={styles.videoSubtext}>
              The video walkthrough for this property will be available soon.
              Until then, browse the photo gallery and contact the agent for a
              personalized tour.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
