import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import SiteHeader from "@/components/SiteHeader";
import HeroSlider from "@/components/HeroSlider";
import AgentBrandProfile from "@/components/AgentBrandProfile/AgentBrandProfile";
import HomeListings from "@/components/HomeListings";
import TrustStats from "@/components/TrustStats";
import LocationCarousel from "@/components/LocationCarousel";
import AgentInquiryForm from "@/components/AgentInquiryForm";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import BackToTop from "@/app/(public)/re/[estate_name]/[propertyId]/BackToTop";
import { agentPhoneEntries } from "@/lib/agentContact";
import { agentWebsiteWhatsAppMessage, resolveAgentWhatsAppNumber } from "@/lib/whatsapp";
import {
  filterNavLinksByPreferences,
  getPropertyViewMode,
  isCategoryEnabled,
  normalizeWebsiteListingPreferences,
} from "@/lib/websiteListingPreferences";
import styles from "@/app/page.module.css";
import "@/app/agent-public-theme.css";

export const AGENT_PUBLIC_NAV = [
  { label: "Home", href: "/" },
  {
    label: "For Sale",
    href: "#for-sale",
    type: "sale",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    label: "For Rent",
    href: "#for-rent",
    type: "rent",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
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
 * Agent public property website UI (`/re/[agent_username]`).
 * Visual theme is isolated via `.agent-public-theme` (see agent-public-theme.css).
 */
export default function PublicPropertyWebsite({
  properties = [],
  heroSlides = [],
  stats,
  locations = [],
  agent = null,
  agentStats = null,
  blogs = [],
  videoPosts = [],
  filesUpdate = null,
}) {
  const listingPreferences = normalizeWebsiteListingPreferences(
    agent?.website_listing_preferences,
  );
  const viewMode = getPropertyViewMode(listingPreferences);
  const agentHandle =
    agent?.username || agent?.estate_name || "";

  const baseNavLinks = (() => {
    if (viewMode === "flat") {
      // Flat view: replace For Sale / For Rent / Plots with a single Properties link.
      // Keep Home and Search Areas; Files Updates is injected below.
      return AGENT_PUBLIC_NAV.filter(
        (item) => !item.type,
      ).map((item) =>
        item.label === "Search Areas"
          ? { label: "Properties", href: "#properties" }
          : item,
      );
    }
    return filterNavLinksByPreferences(AGENT_PUBLIC_NAV, listingPreferences);
  })();

  const navLinks = (() => {
    if (!filesUpdate) return baseNavLinks;
    const filesUpdateLink = {
      label: "Files Updates",
      href: `/re/${encodeURIComponent(agentHandle)}/files-updates`,
    };
    const areasIndex = baseNavLinks.findIndex(
      (item) => item.label === "Search Areas",
    );
    if (areasIndex === -1) return [...baseNavLinks, filesUpdateLink];
    const result = [...baseNavLinks];
    result.splice(areasIndex, 0, filesUpdateLink);
    return result;
  })();

  const trustBackground =
    properties.find((property) => property.featuredImage?.image_url)
      ?.featuredImage?.image_url ||
    heroSlides.find((slide) => slide.image_url)?.image_url ||
    null;

  const phoneEntries = agent ? agentPhoneEntries(agent) : [];
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
    <div className={`agent-public-theme ${styles.wrapper}`}>
      <SiteHeader
        navLinks={navLinks}
        ctaLabel="Sell Your Property"
        ctaHref="#contact"
        logoSrc={agent?.company_logo || "/logo.svg"}
        logoAlt={
          agent?.company_logo && agent?.company_name
            ? `${agent.company_name} logo`
            : "Dhalahore Properties"
        }
      />
      <HomeListings
        properties={properties}
        listingPreferences={listingPreferences}
        viewMode={viewMode}
      >
        <HeroSlider slides={heroSlides} />
        <div className={styles.container}>
          <AgentBrandProfile agent={agent} stats={agentStats} />
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
                  href="#for-sale"
                  className={styles.textLink}
                  data-view-all-homes
                >
                  View All Homes
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
                        {phoneEntries.length > 0 ? (
                          <span className={styles.contactPhoneNumbers}>
                            {phoneEntries.map((entry, index) => (
                              <Fragment key={entry.number}>
                                {index > 0 ? "\t" : null}
                                <a
                                  href={entry.href}
                                  className={styles.contactDetailLink}
                                >
                                  {entry.number}
                                </a>
                              </Fragment>
                            ))}
                          </span>
                        ) : contactPhone && contactTelHref ? (
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
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactOffice)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {contactOffice}
                          </a>
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

          {blogs.length > 0 ? (
            <section id="blogs" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.kicker}>Insights</p>
                  <h2 className={styles.sectionTitle}>Latest Articles</h2>
                </div>
              </div>

              <div className={styles.blogGrid}>
                {blogs.map((blog) => {
                  const blogHref = `/re/${encodeURIComponent(agent?.username || agent?.estate_name || "")}/blogs/${encodeURIComponent(blog.slug)}`;
                  return (
                    <Link key={blog.id} href={blogHref} className={styles.blogCard}>
                      {blog.cover_image ? (
                        <div className={styles.blogMedia}>
                          <Image
                            src={blog.cover_image}
                            alt={blog.title || "Blog article"}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className={styles.blogImage}
                          />
                        </div>
                      ) : (
                        <div className={styles.blogMedia}>
                          <div className={styles.blogMediaFallback} />
                        </div>
                      )}
                      <div className={styles.blogBody}>
                        <h3 className={styles.blogTitle}>{blog.title}</h3>
                        {blog.short_description ? (
                          <p className={styles.blogExcerpt}>
                            {blog.short_description}
                          </p>
                        ) : null}
                        <span className={styles.blogReadMore}>Read article</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {videoPosts.length > 0 ? (
            <section id="videos" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.kicker}>Watch</p>
                  <h2 className={styles.sectionTitle}>Video posts</h2>
                </div>
              </div>

              <div className={styles.videoPostGrid}>
                {videoPosts.map((videoPost) => {
                  const videoHref = `/re/${encodeURIComponent(agent?.username || agent?.estate_name || "")}/videos/${encodeURIComponent(videoPost.slug)}`;
                  return (
                    <Link key={videoPost.id} href={videoHref} className={styles.videoPostCard}>
                      <div className={styles.videoPostMedia}>
                        {videoPost.thumbnail_url ? (
                          <Image
                            src={videoPost.thumbnail_url}
                            alt={videoPost.title || "Video post"}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className={styles.videoPostImage}
                          />
                        ) : (
                          <div className={styles.videoPostMediaFallback} />
                        )}
                        <span className={styles.videoPostPlay} aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="28" height="28">
                            <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
                            <path d="M9 7v10l8-5-8-5Z" fill="white" />
                          </svg>
                        </span>
                      </div>
                      <div className={styles.videoPostBody}>
                        <h3 className={styles.videoPostTitle}>{videoPost.title}</h3>
                        {videoPost.description ? (
                          <p className={styles.videoPostExcerpt}>
                            {videoPost.description}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
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
              {viewMode === "flat" ? (
                <Link href="#properties">Properties</Link>
              ) : (
                <>
                  {isCategoryEnabled(listingPreferences, "sale") ? (
                    <Link href="#for-sale">For Sale</Link>
                  ) : null}
                  {isCategoryEnabled(listingPreferences, "rent") ? (
                    <Link href="#for-rent">For Rent</Link>
                  ) : null}
                  {isCategoryEnabled(listingPreferences, "plot") ? (
                    <Link href="#plots">Plots</Link>
                  ) : null}
                </>
              )}
              <Link href="#why-us">How It Works</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Agents</h4>
              <Link href="/become-an-agent">Sign up</Link>
              <Link href="/agent/login">Login</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Contact</h4>
              {phoneEntries.length > 0
                ? phoneEntries.map((entry) => (
                    <a key={entry.number} href={entry.href}>
                      {entry.number}
                    </a>
                  ))
                : contactPhone && contactTelHref ? (
                    <a href={contactTelHref}>{contactPhone}</a>
                  ) : null}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactOffice)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {contactOffice}
              </a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Dhalahore Properties</span>
            <span>Trusted Lahore listings</span>
          </div>
        </footer>
      </main>

      {resolveAgentWhatsAppNumber(agent) ? (
        <AgentWhatsAppFab
          phone={resolveAgentWhatsAppNumber(agent)}
          message={agentWebsiteWhatsAppMessage(agent.full_name)}
        />
      ) : null}
      <BackToTop revealAtId="for-sale-commercial" />
    </div>
  );
}
