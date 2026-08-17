import Link from "next/link";
import Image from "next/image";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import SiteHeader from "@/components/SiteHeader";
import HeroSlider from "@/components/HeroSlider";
import AboutDHALahore from "@/components/AboutDHALahore/AboutDHALahore";
import AgentBrandProfile from "@/components/AgentBrandProfile/AgentBrandProfile";
import HomeListings from "@/components/HomeListings";
import TrustStats from "@/components/TrustStats";
import LocationCarousel from "@/components/LocationCarousel";
import AgentInquiryForm from "@/components/AgentInquiryForm";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { agentWebsiteWhatsAppMessage } from "@/lib/whatsapp";
import styles from "@/app/page.module.css";

const AGENT_PUBLIC_NAV = [
  { label: "Home", href: "/" },
  {
    label: "For Sale",
    href: "#sale",
    type: "sale",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    label: "For Rent",
    href: "#rent",
    type: "rent",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    label: "Plots",
    href: "#plots",
    type: "plot",
    children: [
      { label: "Residential", subtype: "residential_plot" },
      { label: "Commercial", subtype: "commercial_plot" },
    ],
  },
  { label: "Search Areas", href: "#areas" },
];

/**
 * Shared public property website UI (homepage design).
 * Used by `/` (marketplace) and `/re/[agent_username]` (per-agent site).
 * Visual design must stay identical — only data/props differ.
 */
export default function PublicPropertyWebsite({
  properties = [],
  heroSlides = [],
  stats,
  locations = [],
  agent = null,
  agentStats = null,
}) {
  const trustBackground =
    properties.find((property) => property.featuredImage?.image_url)
      ?.featuredImage?.image_url ||
    heroSlides.find((slide) => slide.image_url)?.image_url ||
    null;

  const contactPhone = agent
    ? agent.phone || null
    : "+92 300 123 4567";
  const contactEmail = agent?.email || "info@dhalahore.com";
  const contactTelHref = contactPhone
    ? `tel:${String(contactPhone).replace(/\s/g, "")}`
    : null;
  const contactOffice =
    agent?.office_address || "12 Garden Town, Lahore";

  return (
    <div className={styles.wrapper}>
      <SiteHeader
        navLinks={AGENT_PUBLIC_NAV}
        ctaLabel="Sell your property"
        ctaHref="#contact"
        logoSrc={agent?.company_logo || "/logo.svg"}
        logoAlt={
          agent?.company_logo && agent?.company_name
            ? `${agent.company_name} logo`
            : "Dhalahore Properties"
        }
      />
      <HomeListings properties={properties}>
        <HeroSlider slides={heroSlides} />
        <div className={styles.container}>
          {agent ? (
            <AgentBrandProfile agent={agent} stats={agentStats} />
          ) : (
            <AboutDHALahore />
          )}
        </div>
      </HomeListings>

      <main className={styles.main}>
        <div className={styles.container}>
          <TrustStats stats={stats} backgroundImage={trustBackground} />

          {locations.length > 0 ? (
            <section id="areas" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.kicker}>Explore Lahore</p>
                  <h2 className={styles.sectionTitle}>Browse by location</h2>
                </div>
                <a
                  href="#sale"
                  className={styles.textLink}
                  data-view-all-homes
                >
                  View all homes
                </a>
              </div>

              <LocationCarousel locations={locations} />
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

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <div className={styles.contactGrid}>
                <div className={styles.contactInfo}>
                  <p className={styles.contactKicker}>Contact</p>
                  <h2 className={styles.contactHeading}>
                    Let&apos;s Talk About Your Next Property
                  </h2>
                  <p className={styles.contactCopy}>
                    {agent
                      ? `Reach out to ${agent.full_name} for buying, selling, or investment guidance.`
                      : "Reach out to our Lahore team for buying, selling, or investment guidance."}
                  </p>

                  <div className={styles.contactDetails}>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 5.5C3 4.7 3.7 4 4.5 4H7c.6 0 1 .4 1 1v1.5c0 .8-.7 1.5-1.5 1.5H6c-.3 0-.5.2-.5.5v1.5c0 .3.2.5.5.5h1c.8 0 1.5.7 1.5 1.5V17c0 .6-.4 1-1 1H4.5C3.7 18 3 17.3 3 16.5V5.5Z" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M11 8h7.5c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5H11" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M16 12.5 18.5 14.5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <div>
                        <p className={styles.contactDetailLabel}>Phone</p>
                        {contactPhone && contactTelHref ? (
                          <a
                            href={contactTelHref}
                            className={styles.contactDetailLink}
                          >
                            {contactPhone}
                          </a>
                        ) : (
                          <p className={styles.contactDetailValue}>Not provided</p>
                        )}
                      </div>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 7.5 12 13.5 21 7.5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 7.5v9c0 .8-.7 1.5-1.5 1.5H4.5C3.7 18 3 17.3 3 16.5v-9" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <div>
                        <p className={styles.contactDetailLabel}>Email</p>
                        <a
                          href={`mailto:${contactEmail}`}
                          className={styles.contactDetailLink}
                        >
                          {contactEmail}
                        </a>
                      </div>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 20.5s7-3.25 7-8.5c0-3.6-2.9-6.5-7-6.5S5 8.4 5 12c0 5.25 7 8.5 7 8.5Z" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="#1A1A1A" strokeWidth="1.8"/>
                        </svg>
                      </span>
                      <div>
                        <p className={styles.contactDetailLabel}>Office</p>
                        <p className={styles.contactDetailValue}>
                          {contactOffice}
                        </p>
                      </div>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 6h8" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round"/>
                          <path d="M8 10h8" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </span>
                      <div>
                        <p className={styles.contactDetailLabel}>Hours</p>
                        <p className={styles.contactDetailValue}>Mon–Fri, 9am–6pm</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.contactFormPanel}>
                  {agent?.id ? (
                    <AgentInquiryForm
                      agentId={agent.id}
                      variant="website"
                      kicker="Send a message"
                      heading="Tell us what you need and our team will respond quickly."
                    />
                  ) : (
                    <>
                      <p className={styles.contactFormKicker}>Send a message</p>
                      <h3 className={styles.contactFormHeading}>
                        Tell us what you need and our team will respond quickly.
                      </h3>
                      <p className={styles.contactCopy}>
                        Contact is available on agent websites.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerAccent} aria-hidden="true" />
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <Image
                src={agent?.company_logo || "/logo-white.svg"}
                alt={
                  agent?.company_logo && agent?.company_name
                    ? `${agent.company_name} logo`
                    : "Dhalahore Properties"
                }
                width={PUBLIC_SITE_LOGO_DIMENSIONS.width}
                height={PUBLIC_SITE_LOGO_DIMENSIONS.height}
                quality={PUBLIC_SITE_LOGO_DIMENSIONS.quality}
                sizes={PUBLIC_SITE_LOGO_DIMENSIONS.sizes}
                className={styles.footerLogo}
              />
              <p>
                Lahore&apos;s marketplace for verified agent listings — clear
                pricing, direct contact, no middlemen.
              </p>
            </div>

            <div className={styles.footerCol}>
              <h4>Properties</h4>
              <Link href="#sale">For Sale</Link>
              <Link href="#rent">For Rent</Link>
              <Link href="#plots">Plots</Link>
              <Link href="#why-us">How it works</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Agents</h4>
              <Link href="/agent/signup">Sign up</Link>
              <Link href="/agent/login">Login</Link>
              <Link href="/agent/properties/new">Add property</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Contact</h4>
              {contactPhone && contactTelHref ? (
                <a href={contactTelHref}>{contactPhone}</a>
              ) : null}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              <span>{contactOffice}</span>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Dhalahore Properties</span>
            <span>Trusted Lahore listings</span>
          </div>
        </footer>
      </main>

      {agent?.phone ? (
        <AgentWhatsAppFab
          phone={agent.phone}
          message={agentWebsiteWhatsAppMessage(agent.full_name)}
        />
      ) : null}
    </div>
  );
}
