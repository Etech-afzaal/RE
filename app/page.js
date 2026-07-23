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
import AboutDHALahore from "@/components/AboutDHALahore/AboutDHALahore";
import HomeListings from "@/components/HomeListings";
import TrustStats from "@/components/TrustStats";
import LocationCarousel from "@/components/LocationCarousel";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Dhalahore Properties — Find Your Next Property in Lahore",
  description:
    "Browse verified property listings from trusted Lahore estate agents, or list your own properties on Dhalahore Properties.",
};

export default async function HomePage() {
  const [properties, heroSlides, stats, locations] = await Promise.all([
    getFeaturedProperties(24),
    getHeroSlides(5),
    getPublicStats(),
    getPopularLocations(24),
  ]);

  const inquiryPhone = heroSlides[0]?.agent_phone || null;
  const telHref = inquiryPhone
    ? `tel:${inquiryPhone.replace(/\s/g, "")}`
    : "#sale";
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
      <div className={styles.container}>
        <AboutDHALahore />
      </div>

      <main className={styles.main}>
        <div className={styles.container}>
          <HomeListings properties={properties} />

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

          <section id="contact" className={styles.contactSection}>
            <div className={styles.contactCard}>
              <div className={styles.contactGrid}>
                <div className={styles.contactInfo}>
                  <p className={styles.contactKicker}>CONTACT US</p>
                  <h2 className={styles.contactHeading}>
                    Let's Talk About Your Next Property
                  </h2>
                  <p className={styles.contactCopy}>
                    Reach out to our Lahore team for buying, selling, or investment guidance. We help serious buyers and trusted agents connect quickly.
                  </p>

                  <div className={styles.chooseList}>
                    <p className={styles.chooseHeading}>Why Choose Dhalahore?</p>
                    <ul>
                      <li>Verified Lahore listings from trusted estate agents.</li>
                      <li>Clear pricing and quick direct contact.</li>
                      <li>Premium local support for buyers and sellers.</li>
                      <li>Effortless shortlisting with smart property details.</li>
                    </ul>
                  </div>

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
                        <p className={styles.contactDetailValue}>+92 300 123 4567</p>
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
                        <p className={styles.contactDetailValue}>info@dhalahore.com</p>
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
                        <p className={styles.contactDetailValue}>12 Garden Town, Lahore</p>
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
                  <p className={styles.contactFormKicker}>Send a message</p>
                  <h3 className={styles.contactFormHeading}>
                    Tell us what you need and our team will respond quickly.
                  </h3>
                  <form className={styles.contactForm}>
                    <label className={styles.formField}>
                      <span className={styles.formLabel}>Full Name</span>
                      <input
                        type="text"
                        placeholder="Full Name"
                        className={styles.contactInput}
                      />
                    </label>
                    <label className={styles.formField}>
                      <span className={styles.formLabel}>Email Address</span>
                      <input
                        type="email"
                        placeholder="Email Address"
                        className={styles.contactInput}
                      />
                    </label>
                    <label className={styles.formField}>
                      <span className={styles.formLabel}>Phone Number</span>
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        className={styles.contactInput}
                      />
                    </label>
                    <label className={styles.formField}>
                      <span className={styles.formLabel}>Subject</span>
                      <input
                        type="text"
                        placeholder="e.g. Buying, Selling or Renting a Property"
                        className={styles.contactInput}
                      />
                    </label>
                    <label className={styles.formField}>
                      <span className={styles.formLabel}>Message</span>
                      <textarea
                        rows="5"
                        placeholder="Write your message"
                        className={styles.contactTextarea}
                      />
                    </label>
                    <button type="button" className={`${styles.btnPrimary} ${styles.contactSubmit}`}>
                      Send Message
                    </button>
                  </form>
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
                src="/logo-white.svg"
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
              <h4>Properties</h4>
              <Link href="/#sale">Sale</Link>
              <Link href="/#rent">Rent</Link>
              <Link href="/#plots">Plots</Link>
              <Link href="/#why-us">How it works</Link>
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
