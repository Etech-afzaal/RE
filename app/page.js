import Link from "next/link";
import Image from "next/image";
import {
  getFeaturedProperties,
  getHeroSlides,
  getPopularLocations,
  getPublicStats,
} from "@/lib/queries";
import SiteHeader from "@/components/SiteHeader";
import HeroSlider from "@/components/HeroSlider";
import HomeListings from "@/components/HomeListings";
import TrustStats from "@/components/TrustStats";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Dhalahore Properties — Find Your Next Property in Lahore",
  description:
    "Browse verified property listings from trusted Lahore estate agents, or list your own properties on Dhalahore Properties.",
};

export default async function HomePage({ searchParams }) {
  const type =
    typeof searchParams?.type === "string"
      ? searchParams.type.toLowerCase()
      : "";

  const [properties, heroSlides, stats, locations] = await Promise.all([
    getFeaturedProperties(9),
    getHeroSlides(5),
    getPublicStats(),
    getPopularLocations(4),
  ]);

  const inquiryPhone = heroSlides[0]?.agent_phone || null;
  const telHref = inquiryPhone
    ? `tel:${inquiryPhone.replace(/\s/g, "")}`
    : "#properties";
  const agentCtaImage =
    heroSlides.find((slide) => slide.image_url)?.image_url ||
    properties.find((property) => property.featuredImage?.image_url)
      ?.featuredImage?.image_url ||
    null;
  const trustBackground =
    properties.find((property) => property.featuredImage?.image_url)
      ?.featuredImage?.image_url ||
    heroSlides.find((slide) => slide.image_url)?.image_url ||
    null;

  return (
    <div className={styles.wrapper}>
      <SiteHeader />
      <HeroSlider slides={heroSlides} />

      <main className={styles.main}>
        <div className={styles.container}>
          <HomeListings properties={properties} filterType={type} />

          <TrustStats stats={stats} backgroundImage={trustBackground} />

          {locations.length > 0 ? (
            <section id="areas" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.kicker}>Explore Lahore</p>
                  <h2 className={styles.sectionTitle}>Browse by location</h2>
                </div>
                <a href="#properties" className={styles.textLink}>
                  View all homes
                </a>
              </div>

              <div className={styles.locationGrid}>
                {locations.map((loc) => (
                  <a
                    key={loc.name}
                    href="#properties"
                    className={styles.locationCard}
                  >
                    <div className={styles.locationMedia}>
                      {loc.image_url ? (
                        <Image
                          src={loc.image_url}
                          alt={loc.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className={styles.locationImage}
                        />
                      ) : (
                        <div className={styles.locationFallback} />
                      )}
                      <div className={styles.locationOverlay} />
                    </div>
                    <div className={styles.locationBody}>
                      <span className={styles.locationTag}>Neighborhood</span>
                      <h3>{loc.name}</h3>
                      <p>
                        {loc.listingCount}{" "}
                        {Number(loc.listingCount) === 1
                          ? "listing"
                          : "listings"}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section id="why-us" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>How it works</p>
                <h2 className={styles.sectionTitle}>
                  Buy with clarity, sell with confidence
                </h2>
              </div>
            </div>

            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNum}>01</span>
                <div>
                  <h3>Search verified homes</h3>
                  <p>
                    Filter by area across listings published only by approved
                    Lahore agents.
                  </p>
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>02</span>
                <div>
                  <h3>Compare details fast</h3>
                  <p>
                    Size, location, and asking price sit up front so you can
                    shortlist without guesswork.
                  </p>
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>03</span>
                <div>
                  <h3>Message the agent</h3>
                  <p>
                    Reach the listing agent directly from any property page and
                    book a viewing.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className={styles.sellCta}>
            {agentCtaImage ? (
              <Image
                src={agentCtaImage}
                alt=""
                fill
                sizes="(max-width: 1240px) 100vw, 1240px"
                className={styles.sellCtaImage}
              />
            ) : null}
            <div className={styles.sellCtaOverlay} aria-hidden="true" />
            <div className={styles.sellCopy}>
              <p className={styles.kickerLight}>For estate agents</p>
              <h2>List your properties. Reach serious buyers.</h2>
              <p>
                Get a branded page at{" "}
                <strong>dhalahore.com/re/your-estate</strong> and manage your
                portfolio in one place.
              </p>
            </div>
            <div className={styles.sellActions}>
              <Link href="/agent/signup" className={styles.btnPrimary}>
                Become an agent
              </Link>
              <Link href="/agent/login" className={styles.btnGhost}>
                Agent login
              </Link>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerAccent} aria-hidden="true" />
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <Image
                src="/logo.svg"
                alt="Dhalahore Properties"
                width={155}
                height={43}
              />
              <p>
                Lahore&apos;s marketplace for verified agent listings — clear
                pricing, direct contact, no middlemen.
              </p>
            </div>

            <div className={styles.footerCol}>
              <h4>Buy</h4>
              <a href="#properties">Featured homes</a>
              <a href="#areas">Browse locations</a>
              <a href="#why-us">How it works</a>
            </div>

            <div className={styles.footerCol}>
              <h4>Agents</h4>
              <Link href="/agent/signup">Sign up</Link>
              <Link href="/agent/login">Login</Link>
              <Link href="/agent/properties/new">Add property</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Contact</h4>
              {inquiryPhone ? (
                <a href={telHref}>{inquiryPhone}</a>
              ) : (
                <span>Inquiries via listing agents</span>
              )}
              <Link href="/admin/login">Admin</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Dhalahore Properties</span>
            <span>Trusted Lahore listings</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
