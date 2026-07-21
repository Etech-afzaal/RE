import Link from "next/link";
import Image from "next/image";
import { getFeaturedProperties, getHeroSlides } from "@/lib/queries";
import SiteHeader from "@/components/SiteHeader";
import HeroSlider from "@/components/HeroSlider";
import styles from "./page.module.css";

export const revalidate = 60;

const formatPrice = (price) =>
  price ? `PKR ${Number(price).toLocaleString()}` : "Price on request";

export const metadata = {
  title: "Dhalahore Properties — Find Your Next Property in Lahore",
  description:
    "Browse verified property listings from trusted Lahore estate agents, or list your own properties on Dhalahore Properties.",
};

export default async function HomePage() {
  const [properties, heroSlides] = await Promise.all([
    getFeaturedProperties(6),
    getHeroSlides(3),
  ]);

  const inquiryPhone = heroSlides[0]?.agent_phone || null;

  return (
    <div className={styles.wrapper}>
      <SiteHeader phone={inquiryPhone} />
      <HeroSlider slides={heroSlides} />

      <div className={styles.container}>
        <section id="listings" className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Fresh on the market</p>
              <h2 className={styles.sectionTitle}>Featured listings</h2>
            </div>
          </div>

          {properties.length === 0 ? (
            <div className={styles.emptyState}>
              New listings are on their way &mdash; check back soon, or{" "}
              <Link href="/agent/login">log in as an agent</Link> to publish the
              first one.
            </div>
          ) : (
            <div className={styles.propertiesGrid}>
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/re/${property.estate_name}/${property.id}`}
                  className={styles.propertyCard}
                >
                  <div className={styles.propertyImageWrapper}>
                    {property.featuredImage ? (
                      <Image
                        src={property.featuredImage.image_url}
                        alt={property.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className={styles.propertyImage}
                      />
                    ) : (
                      <div className={styles.propertyFallback} />
                    )}
                  </div>
                  <div className={styles.propertyContent}>
                    <span className={styles.propertyTag}>
                      {property.agent_name}
                    </span>
                    <h3 className={styles.propertyTitle}>{property.title}</h3>
                    <p className={styles.propertyText}>
                      {property.location || "Location not specified"}
                    </p>
                    <div className={styles.propertyMeta}>
                      {property.size_value ? (
                        <span className={styles.propertyText}>
                          {property.size_value} {property.size_unit}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className={styles.propertyPrice}>
                        {formatPrice(property.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="why-us" className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Why Dhalahore</p>
              <h2 className={styles.sectionTitle}>
                Built for buyers and agents alike
              </h2>
            </div>
          </div>

          <div className={styles.valueGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>1</div>
              <h3 className={styles.valueTitle}>Approved agents only</h3>
              <p className={styles.valueText}>
                Every agent is manually approved before they can publish
                listings, keeping the marketplace trustworthy.
              </p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>2</div>
              <h3 className={styles.valueTitle}>Real-time listings</h3>
              <p className={styles.valueText}>
                Agents manage their own portfolio, so listings and prices stay
                current without a middleman.
              </p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>3</div>
              <h3 className={styles.valueTitle}>One click to contact</h3>
              <p className={styles.valueText}>
                Send a message straight to the listing agent from any property
                page and get a fast response.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.agentCta}>
          <div>
            <h2 className={styles.agentCtaTitle}>
              Are you an estate agent in Lahore?
            </h2>
            <p className={styles.agentCtaText}>
              Get your own branded listings page at{" "}
              <strong>dhalahore.com/re/your-estate</strong>, manage your
              portfolio, and receive inquiries directly from serious buyers.
            </p>
          </div>
          <div className={styles.agentCtaActions}>
            <Link href="/agent/signup" className={styles.primaryButton}>
              Sign up as an agent
            </Link>
            <Link href="/agent/login" className={styles.secondaryButton}>
              Agent login
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          Dhalahore Properties &middot; Trusted Lahore listings delivered with
          clarity.
        </footer>
      </div>
    </div>
  );
}
