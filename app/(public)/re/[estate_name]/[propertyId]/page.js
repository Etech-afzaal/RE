import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import GalleryCarousel from "./GalleryCarousel";
import HeroGallery from "./HeroGallery";
import {
  getAgentByUsername,
  getPropertyByAgentAndSlug,
} from "@/lib/queries";
import { agentPublicUsername } from "@/lib/propertySlug";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";

const formatPrice = (price) =>
  price ? `PKR ${Number(price).toLocaleString()}` : "Price on request";

const formatSize = (value, unit) => {
  if (value == null || value === "") return null;
  return `${Number(value) || value} ${unit || ""}`.trim();
};

const formatDate = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

function titleCaseWords(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer stored company_name; otherwise derive from username/estate. */
function companyNameFromAgent(agent) {
  if (agent.company_name && String(agent.company_name).trim()) {
    return String(agent.company_name).trim();
  }
  const base = titleCaseWords(agentPublicUsername(agent) || agent.estate_name);
  if (!base) return "Agency Properties";
  if (/propert/i.test(base)) return base;
  return `${base} Properties`;
}

function companyInitials(companyName) {
  const words = String(companyName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "RE";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

/** Split "Johar Town, Lahore" into area + city when possible. */
function parseLocation(location) {
  const raw = String(location || "").trim();
  if (!raw) return { area: null, city: null, full: null };
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      area: parts.slice(0, -1).join(", "),
      city: parts[parts.length - 1],
      full: raw,
    };
  }
  return { area: raw, city: null, full: raw };
}

/** Build a WhatsApp deep link from a local or international phone number. */
function whatsappHref(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

const TRUST_ITEMS = [
  {
    title: "Verified Agent",
    copy: "This agent was manually approved before listing on the platform.",
  },
  {
    title: "Direct Contact",
    copy: "Your inquiry goes straight to the listing agent — no middlemen.",
  },
  {
    title: "Genuine Listings",
    copy: "Properties are reviewed before they appear on public pages.",
  },
  {
    title: "Private Viewings",
    copy: "Schedule a private visit at a time that suits you.",
  },
];

export default async function PropertyDetailPage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const agentHandle = agentPublicUsername(agent);
  const property = await getPropertyByAgentAndSlug(
    agent.id,
    params.propertyId,
  );
  if (!property) return notFound();

  const companyName = companyNameFromAgent(agent);
  const sizeLabel = formatSize(property.size_value, property.size_unit);
  const listedDate = formatDate(property.created_at);
  const locationInfo = parseLocation(property.location);
  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "draft"
        ? "Draft"
        : "For Sale";

  const gallery = property.images || [];
  const heroImage = property.featuredImage || gallery[0] || null;

  /** Hero shows only exterior elevations — interiors live in the space rail. */
  const HERO_PRIMARY = new Set(["front_view", "back_view"]);
  const HERO_FILL = new Set([
    "garden",
    "street_view",
    "gate",
    "terrace",
    "community_view",
  ]);
  const heroImages = (() => {
    const primary = gallery.filter((img) => HERO_PRIMARY.has(img.category));
    const fill = gallery.filter((img) => HERO_FILL.has(img.category));
    const picked = [];
    const push = (img) => {
      if (!img || picked.length >= 3) return;
      if (picked.some((p) => p.id === img.id)) return;
      picked.push(img);
    };

    // Featured first when it is an exterior elevation.
    if (
      heroImage &&
      (HERO_PRIMARY.has(heroImage.category) ||
        HERO_FILL.has(heroImage.category))
    ) {
      push(heroImage);
    }
    for (const img of primary) push(img);
    for (const img of fill) push(img);

    // Soft fallback so a listing is never left without a hero photo.
    if (picked.length === 0 && heroImage) push(heroImage);
    if (picked.length === 0 && gallery[0]) push(gallery[0]);
    return picked;
  })();

  const inquiryHref = `mailto:${agent.email}?subject=${encodeURIComponent(
    `Inquiry — ${property.title} (Ref #${property.id})`,
  )}`;
  const viewingHref = `mailto:${agent.email}?subject=${encodeURIComponent(
    `Viewing request — ${property.title} (Ref #${property.id})`,
  )}`;
  const telHref = agent.phone
    ? `tel:${String(agent.phone).replace(/\s/g, "")}`
    : null;
  const waHref = whatsappHref(agent.phone);
  const agentProfileHref = `/re/${encodeURIComponent(agentHandle)}`;

  const highlights = [
    sizeLabel
      ? { value: sizeLabel, label: "Plot Size" }
      : null,
    locationInfo.area
      ? { value: locationInfo.area, label: "Area" }
      : null,
    locationInfo.city
      ? { value: locationInfo.city, label: "City" }
      : null,
    { value: statusLabel, label: "Listing" },
    listedDate ? { value: listedDate, label: "Listed" } : null,
  ].filter(Boolean);

  const spaceSlides = gallery.map((img) => ({
    id: `db-${img.id}`,
    image: img.image_url,
    label:
      img.image_title ||
      (img.category ? img.category_label : property.title),
    category: img.category,
    categoryLabel: img.category_label,
    copy: null,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* 1. Agent brand header — no DhaLahore logo */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <BackButton
              fallbackHref={agentProfileHref}
              label="← Back"
              className={styles.backBtn}
            />
            <Link href={agentProfileHref} className={styles.brandLink}>
              {agent.company_logo ? (
                <Image
                  src={agent.company_logo}
                  alt=""
                  width={44}
                  height={44}
                  className={styles.brandLogo}
                />
              ) : (
                <span className={styles.brandLogoFallback} aria-hidden="true">
                  {companyInitials(companyName)}
                </span>
              )}
              <span className={styles.brandText}>
                <span className={styles.brandName}>{companyName}</span>
                <span className={styles.brandSub}>Listed by {agent.full_name}</span>
              </span>
            </Link>
          </div>
          <div className={styles.headerActions}>
            <a href={inquiryHref} className={styles.contactButton}>
              Contact Agent
            </a>
          </div>
        </header>

        {/* 2. Hero property media */}
        <HeroGallery images={heroImages} title={property.title} />

        {/* Summary + sticky agent contact + details */}
        <section className={styles.overview}>
          {/* 3. Property summary card */}
          <article className={`${styles.summaryCard} ${styles.overviewSummary}`}>
            <div className={styles.badges}>
              <span className={styles.statusBadge}>{statusLabel}</span>
              {property.location ? (
                <span className={styles.locationBadge}>
                  {property.location}
                </span>
              ) : null}
              <span className={styles.refBadge}>Ref #{property.id}</span>
            </div>
            <h1 className={styles.title}>{property.title}</h1>
            <p className={styles.price}>{formatPrice(property.price)}</p>
          </article>

          {/* 4. Agent contact card */}
          <aside className={styles.agentCard}>
            <div className={styles.agentBrandRow}>
              {agent.company_logo ? (
                <Image
                  src={agent.company_logo}
                  alt=""
                  width={52}
                  height={52}
                  className={styles.agentCompanyLogo}
                />
              ) : (
                <span className={styles.agentCompanyFallback} aria-hidden="true">
                  {companyInitials(companyName)}
                </span>
              )}
              <div>
                <p className={styles.agentCompanyName}>{companyName}</p>
                <p className={styles.agentKicker}>Listed by</p>
              </div>
            </div>

            <div className={styles.agentTop}>
              <AgentAvatar
                src={agent.profile_image}
                alt=""
                width={56}
                height={56}
                className={styles.agentAvatarImg}
              />
              <div>
                <h2 className={styles.agentName}>{agent.full_name}</h2>
                <span className={styles.verifiedBadge}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2l2.4 2.1 3.1-.4 1 3 2.9 1.2-.7 3.1L23 13.5l-2.3 2.2.4 3.1-3 .9-1.4 2.9-3.1-.8-2.6 1.9-2.6-1.9-3.1.8-1.4-2.9-3-.9.4-3.1L1 13.5l2.3-2.5-.7-3.1L5.5 6.7l1-3 3.1.4L12 2z"
                      fill="#f2bb46"
                    />
                    <path
                      d="M8.5 12.5l2.4 2.4 4.6-5"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Verified Agent
                </span>
              </div>
            </div>

            <div className={styles.agentDetails}>
              {agent.phone ? (
                <a href={telHref} className={styles.agentDetail}>
                  <span>Phone</span>
                  <strong>{agent.phone}</strong>
                </a>
              ) : null}
              <a href={`mailto:${agent.email}`} className={styles.agentDetail}>
                <span>Email</span>
                <strong>{agent.email}</strong>
              </a>
            </div>

            <div className={styles.agentActions}>
              {telHref ? (
                <a href={telHref} className={styles.agentPrimary}>
                  Call Agent
                </a>
              ) : null}
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.agentWhatsApp}
                >
                  WhatsApp
                </a>
              ) : null}
              <a href={viewingHref} className={styles.agentSecondary}>
                Request Viewing
              </a>
            </div>

            <p className={styles.agentNote}>
              Mention ref #{property.id} for a faster response.
            </p>
          </aside>

          <div className={styles.overviewDetails}>
            {/* 5. Property highlights — only real fields */}
            {highlights.length > 0 ? (
              <section className={styles.highlights} aria-label="Property highlights">
                {highlights.map((item) => (
                  <div key={item.label} className={styles.highlightCard}>
                    <strong className={styles.highlightValue}>{item.value}</strong>
                    <span className={styles.highlightLabel}>{item.label}</span>
                  </div>
                ))}
              </section>
            ) : null}

            {/* 6. Property story */}
            {property.description ? (
              <section className={styles.story}>
                <p className={styles.sectionKicker}>The story</p>
                <h2 className={styles.sectionTitle}>Property Overview</h2>
                <p className={styles.storyText}>{property.description}</p>
              </section>
            ) : null}
          </div>
        </section>

        {/* 7. Explore every space — listing photos only */}
        <GalleryCarousel slides={spaceSlides} title={property.title} />

        {/* 8. Property video tour */}
        <section className={styles.videoSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionKicker}>Walkthrough</p>
            <h2 className={styles.sectionTitle}>Property Video Tour</h2>
          </div>
          <div className={styles.videoFrame}>
            {property.video_url ? (
              <video
                className={styles.videoPlayer}
                controls
                preload="metadata"
                src={property.video_url}
                poster={heroImage?.image_url || undefined}
              >
                Your browser does not support this video format.
              </video>
            ) : (
              <>
                {heroImage ? (
                  <Image
                    src={heroImage.image_url}
                    alt=""
                    fill
                    sizes="100vw"
                    className={styles.videoPoster}
                    aria-hidden="true"
                  />
                ) : null}
                <div className={styles.videoScrim} />
                <div className={styles.videoContent}>
                  <span className={styles.videoPlay} aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
                    </svg>
                  </span>
                  <p className={styles.videoKicker}>Private walkthrough</p>
                  <h3 className={styles.videoTitle}>
                    Contact the agent for a viewing
                  </h3>
                  <p className={styles.videoText}>
                    A filmed tour is not available for this listing yet. The
                    agent can arrange a private in-person or live walkthrough.
                  </p>
                  <a href={viewingHref} className={styles.videoCta}>
                    Request a viewing
                  </a>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 9. Location */}
        {locationInfo.full ? (
          <section className={styles.locationSection}>
            <div className={styles.sectionIntro}>
              <p className={styles.sectionKicker}>Neighbourhood</p>
              <h2 className={styles.sectionTitle}>Location</h2>
            </div>
            <div className={styles.locationCard}>
              {locationInfo.area ? (
                <div className={styles.locationRow}>
                  <span>Area</span>
                  <strong>{locationInfo.area}</strong>
                </div>
              ) : null}
              {locationInfo.city ? (
                <div className={styles.locationRow}>
                  <span>City</span>
                  <strong>{locationInfo.city}</strong>
                </div>
              ) : null}
              <div className={styles.locationRow}>
                <span>Address</span>
                <strong>{locationInfo.full}</strong>
              </div>
            </div>
          </section>
        ) : null}

        {/* 10. Agent brand story */}
        <section className={styles.brandStory}>
          <div className={styles.brandStoryInner}>
            <div className={styles.brandStoryLogo}>
              {agent.company_logo ? (
                <Image
                  src={agent.company_logo}
                  alt=""
                  width={72}
                  height={72}
                  className={styles.brandStoryLogoImg}
                />
              ) : (
                <span className={styles.brandStoryLogoFallback} aria-hidden="true">
                  {companyInitials(companyName)}
                </span>
              )}
            </div>
            <div className={styles.brandStoryCopy}>
              <p className={styles.sectionKicker}>The agency</p>
              <h2 className={styles.sectionTitle}>About {companyName}</h2>
              <p className={styles.brandStoryText}>
                {agent.description
                  ? agent.description
                  : `${companyName} helps customers find premium properties across ${
                      locationInfo.city || "Lahore"
                    }.`}
              </p>
              <p className={styles.brandManaged}>
                Managed by <strong>{agent.full_name}</strong>
              </p>
              <Link href={agentProfileHref} className={styles.brandProfileBtn}>
                View Agent Profile
              </Link>
            </div>
          </div>
        </section>

        {/* 11. Trust */}
        <section className={styles.assurance} aria-label="Trust indicators">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className={styles.assuranceCard}>
              <span className={styles.assuranceCheck} aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
              </div>
            </div>
          ))}
        </section>

        {/* 12. Final CTA */}
        <section className={styles.closingCta}>
          <div>
            <p className={styles.closingKicker}>Ready when you are</p>
            <h2 className={styles.closingTitle}>
              Ready to visit this property?
            </h2>
          </div>
          <div className={styles.closingActions}>
            <a href={viewingHref} className={styles.contactButton}>
              Request Viewing
            </a>
            <a href={inquiryHref} className={styles.closingGhost}>
              Contact Agent
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
