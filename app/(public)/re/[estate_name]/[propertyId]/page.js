import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import GalleryCarousel from "./GalleryCarousel";
import HeroGallery from "./HeroGallery";
import ExpandableText from "./ExpandableText";
import PropertyVideoGallery from "@/components/PropertyVideoGallery";
import {
  getAgentByUsername,
  getPropertyByAgentAndSlug,
} from "@/lib/queries";
import { agentPublicUsername } from "@/lib/propertySlug";
import AgentAvatar from "@/components/AgentAvatar";
import AgentInquiryForm from "@/components/AgentInquiryForm";
import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { PUBLIC_SITE_LOGO_DIMENSIONS } from "@/components/publicSiteLogo";
import {
  buildWhatsAppUrl,
  propertyWhatsAppMessage,
} from "@/lib/whatsapp";
import {
  formatPropertyLocation,
  resolveLocationInfo,
} from "@/lib/propertyLocation";
import { formatPropertyPrice } from "@/lib/formatPrice";
import styles from "./page.module.css";

const formatPrice = (price, currency) =>
  formatPropertyPrice(price, currency, { fallback: "Price on request" });

const formatSize = (value, unit) => {
  if (value == null || value === "") return null;
  const raw = `${Number(value) || value} ${unit || ""}`.trim();
  return raw.replace(/\b(marla|kanal|sqft)\b/gi, (match) => {
    if (match.toLowerCase() === "sqft") return "Sqft";
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
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

/**
 * Beds / baths / parking are stored in description by the create form
 * (`Bedrooms: 4 | Bathrooms: 5 | Parking: 2`). Parse them once; strip the
 * meta line so overview text is not duplicated.
 */
function parsePropertyAttributes(property) {
  const raw = String(property.description || "");
  const title = String(property.title || "");
  const searchText = `${raw}\n${title}`;

  const bedsMatch =
    searchText.match(/Bedrooms?:\s*(\d+)/i) ||
    searchText.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i);
  const bathsMatch =
    searchText.match(/Bathrooms?:\s*(\d+)/i) ||
    searchText.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i);
  const parkingMatch =
    searchText.match(/Parking:\s*(\d+)/i) ||
    searchText.match(/(\d+)\s*(?:car\s*)?parking\b/i);

  const furnished =
    /\bunfurnished\b/i.test(searchText)
      ? "Unfurnished"
      : /\bfurnished\b/i.test(searchText)
        ? "Furnished"
        : null;

  const facingMatch = searchText.match(
    /\b(North|South|East|West|North[\s-]?East|North[\s-]?West|South[\s-]?East|South[\s-]?West)[\s-]*facing\b/i,
  );
  const floorMatch =
    searchText.match(/Floor:\s*([^\n|]+)/i) ||
    searchText.match(/\b(\d+(?:st|nd|rd|th)?\s*floor)\b/i);
  const yearMatch =
    searchText.match(/Year\s*Built:\s*(\d{4})/i) ||
    searchText.match(/\bbuilt\s+(?:in\s+)?(\d{4})\b/i);

  const overview = raw
    .replace(
      /\n*\s*Bedrooms?:\s*\d+(?:\s*\|\s*(?:Bathrooms?|Parking):\s*\d+)*\s*$/i,
      "",
    )
    .trim();

  return {
    beds: bedsMatch ? Number(bedsMatch[1]) : null,
    baths: bathsMatch ? Number(bathsMatch[1]) : null,
    parking: parkingMatch ? Number(parkingMatch[1]) : null,
    furnished,
    facing: facingMatch ? titleCaseWords(facingMatch[1]) : null,
    floor: floorMatch ? String(floorMatch[1]).trim() : null,
    yearBuilt: yearMatch ? yearMatch[1] : null,
    overview: overview || null,
  };
}

function inferPropertyTypeLabel(property) {
  const text = `${property.title || ""} ${property.description || ""}`.toLowerCase();
  if (text.includes("plot")) return "Plot";
  if (text.includes("apartment") || text.includes("flat")) return "Apartment";
  if (text.includes("bungalow")) return "Bungalow";
  if (text.includes("villa")) return "Villa";
  if (text.includes("shop") || text.includes("commercial")) return "Commercial";
  if (/\brent\b/.test(text)) return "Rental";
  return "House";
}

function fullSearchText(property) {
  return `${property.title || ""}\n${property.description || ""}`;
}

/**
 * Lifestyle highlights derived only from signals in the listing — never invents
 * amenities the text does not support.
 */
function buildHighlights({ property, attrs, locationInfo, sizeLabel, propertyTypeLabel }) {
  const text = fullSearchText(property);
  const highlights = [];

  if (/\b(modern|contemporary|premium|designer|renovat)/i.test(text)) {
    highlights.push({
      id: "design",
      title: "Modern Architecture",
      copy: "Contemporary design with premium finishes",
      icon: "home",
    });
  } else if (propertyTypeLabel === "House" || propertyTypeLabel === "Bungalow" || propertyTypeLabel === "Villa") {
    highlights.push({
      id: "design",
      title: "Thoughtful Design",
      copy: `A well-planned ${propertyTypeLabel.toLowerCase()} layout for everyday comfort`,
      icon: "home",
    });
  }

  if (/\bsolar\b/i.test(text)) {
    highlights.push({
      id: "solar",
      title: "Solar Ready",
      copy: "Energy-efficient home preparation",
      icon: "sun",
    });
  }

  if (attrs.parking != null && attrs.parking > 0) {
    highlights.push({
      id: "parking",
      title: "Private Parking",
      copy:
        attrs.parking === 1
          ? "Dedicated car porch space"
          : `Dedicated space for ${attrs.parking} cars`,
      icon: "car",
    });
  }

  if (locationInfo.full) {
    highlights.push({
      id: "location",
      title: "Prime Location",
      copy: `Located in ${locationInfo.full}`,
      icon: "pin",
    });
  }

  if (attrs.beds != null && attrs.beds >= 3) {
    highlights.push({
      id: "family",
      title: "Family Ready",
      copy: `${attrs.beds} bedrooms suited to comfortable family living`,
      icon: "family",
    });
  } else if (sizeLabel && propertyTypeLabel !== "Plot") {
    highlights.push({
      id: "space",
      title: "Spacious Living",
      copy: `${sizeLabel} of thoughtfully used living space`,
      icon: "space",
    });
  }

  if (/\bcorner\b/i.test(text)) {
    highlights.push({
      id: "corner",
      title: "Corner Advantage",
      copy: "Corner placement with stronger street presence",
      icon: "pin",
    });
  }

  if (attrs.furnished === "Furnished") {
    highlights.push({
      id: "furnished",
      title: "Move-in Ready",
      copy: "Furnished and prepared for immediate living",
      icon: "home",
    });
  }

  // Cap at 4 so the section stays premium, not crowded.
  return highlights.slice(0, 4);
}

function buildAmenities(attrs, property) {
  const text = fullSearchText(property);
  const items = [];

  if (attrs.parking != null && attrs.parking > 0) items.push("Parking");
  if (/\b(ups|generator|electricity backup|power backup)\b/i.test(text)) {
    items.push("Electricity Backup");
  }
  if (/\b(water supply|overhead tank|boring)\b/i.test(text)) {
    items.push("Water Supply");
  }
  if (/\bgas\b/i.test(text)) items.push("Gas Available");
  if (/\b(security|gated|guard)\b/i.test(text)) items.push("Security");
  if (/\b(internet|wifi|wi-fi|fibre|fiber)\b/i.test(text)) items.push("Internet");
  if (/\b(garden|lawn)\b/i.test(text)) items.push("Garden");
  if (/\b(terrace|rooftop)\b/i.test(text)) items.push("Terrace");
  if (attrs.furnished === "Furnished") items.push("Furnished");
  if (/\b(servant|staff quarter)\b/i.test(text)) items.push("Servant Quarters");
  if (/\b(commercial|market|plaza|boulevard)\b/i.test(text)) {
    items.push("Nearby Commercial Area");
  }

  return [...new Set(items)];
}

function buildLifestylePoints({ attrs, locationInfo, propertyTypeLabel }) {
  const points = [];

  if (locationInfo.area || locationInfo.full) {
    points.push("Peaceful residential environment");
    points.push("Close to schools and markets");
  }
  if (attrs.beds != null && attrs.beds >= 3) {
    points.push("Ideal family location");
  } else if (propertyTypeLabel === "House" || propertyTypeLabel === "Apartment") {
    points.push("Comfortable everyday living");
  }
  if (locationInfo.city || locationInfo.area) {
    points.push("Strong investment potential");
  }

  return points.slice(0, 4);
}

function buildInvestmentPoints({ attrs, propertyTypeLabel, isRent }) {
  const points = [];
  if (attrs.beds != null || propertyTypeLabel === "House" || propertyTypeLabel === "Apartment") {
    points.push("Family living");
  }
  points.push("Long-term investment");
  if (!isRent && propertyTypeLabel !== "Plot") {
    points.push("Rental opportunity");
  }
  if (propertyTypeLabel === "Plot") {
    points.push("Future development potential");
  }
  return points;
}

function HighlightIcon({ name }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
  };

  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "car") {
    return (
      <svg {...common}>
        <path
          d="M4 15.5h16l-1.2-4.2a2 2 0 0 0-1.9-1.4H7.1a2 2 0 0 0-1.9 1.4L4 15.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 15.5v2M17.5 15.5v2M7.5 10l1-3h7l1 3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...common}>
        <path
          d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "family") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4.5 18.5c.6-3 2.5-4.5 4.5-4.5s3.9 1.5 4.5 4.5M13.5 18.5c.3-1.8 1.3-2.8 2.5-2.8 1.4 0 2.4 1.2 2.7 2.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "space") {
    return (
      <svg {...common}>
        <path
          d="M4 9.5 12 4l8 5.5V20H4V9.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M4 10.5 12 4l8 6.5V20H4v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 20v-5.5h5V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LocationPinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={styles.locationPin}
    >
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CompanyLogo({ src, companyName, className }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={companyName || "Company logo"}
        width={PUBLIC_SITE_LOGO_DIMENSIONS.width}
        height={PUBLIC_SITE_LOGO_DIMENSIONS.height}
        quality={PUBLIC_SITE_LOGO_DIMENSIONS.quality}
        sizes={PUBLIC_SITE_LOGO_DIMENSIONS.sizes}
        className={`${styles.companyLogoImg} ${className || ""}`}
      />
    );
  }

  return (
    <span
      className={`${styles.companyLogoFallback} ${className || ""}`}
      aria-hidden="true"
    >
      {companyInitials(companyName)}
    </span>
  );
}

const TRUST_ITEMS = [
  "Verified Agent",
  "Direct Contact",
  "Property Information Verified",
  "Private Viewing Available",
];

const NEARBY_ITEMS = [
  "Main Boulevard",
  "Schools",
  "Shopping Areas",
  "Hospitals",
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
  const locationInfo = resolveLocationInfo(property);
  const attrs = parsePropertyAttributes(property);
  const propertyTypeLabel = inferPropertyTypeLabel(property);
  const isRent = /\brent\b/i.test(fullSearchText(property));
  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "draft"
        ? "Draft"
        : isRent
          ? "For Rent"
          : "For Sale";

  const gallery = property.images || [];
  const heroImage = property.featuredImage || gallery[0] || null;
  const propertyVideos = property.videos || [];

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

    if (
      heroImage &&
      (HERO_PRIMARY.has(heroImage.category) ||
        HERO_FILL.has(heroImage.category))
    ) {
      push(heroImage);
    }
    for (const img of primary) push(img);
    for (const img of fill) push(img);

    if (picked.length === 0 && heroImage) push(heroImage);
    if (picked.length === 0 && gallery[0]) push(gallery[0]);
    return picked;
  })();

  const telHref = agent.phone
    ? `tel:${String(agent.phone).replace(/\s/g, "")}`
    : null;
  const waHref = buildWhatsAppUrl(agent.phone);
  const waFabMessage = propertyWhatsAppMessage(
    agent.full_name,
    property.title,
    formatPropertyLocation(property),
  );
  const agentProfileHref = `/re/${encodeURIComponent(agentHandle)}`;

  /** Compact glance chips inside the summary card. */
  const summaryChips = [
    sizeLabel,
    attrs.beds != null
      ? `${attrs.beds} ${attrs.beds === 1 ? "Bedroom" : "Bedrooms"}`
      : null,
    attrs.baths != null
      ? `${attrs.baths} ${attrs.baths === 1 ? "Bathroom" : "Bathrooms"}`
      : null,
    propertyTypeLabel,
  ].filter(Boolean);

  const highlights = buildHighlights({
    property,
    attrs,
    locationInfo,
    sizeLabel,
    propertyTypeLabel,
  });

  const detailRows = [
    { label: "Property Type", value: propertyTypeLabel },
    { label: "Listing Type", value: statusLabel },
    sizeLabel ? { label: "Size", value: sizeLabel } : null,
    locationInfo.area ? { label: "Area", value: locationInfo.area } : null,
    locationInfo.phase ? { label: "Phase", value: locationInfo.phase } : null,
    locationInfo.city ? { label: "City", value: locationInfo.city } : null,
    locationInfo.address
      ? { label: "Address", value: locationInfo.address }
      : null,
    attrs.beds != null
      ? {
          label: "Bedrooms",
          value: String(attrs.beds),
        }
      : null,
    attrs.baths != null
      ? {
          label: "Bathrooms",
          value: String(attrs.baths),
        }
      : null,
    attrs.parking != null
      ? {
          label: "Parking",
          value: String(attrs.parking),
        }
      : null,
    attrs.furnished ? { label: "Furnishing", value: attrs.furnished } : null,
    attrs.facing ? { label: "Facing", value: attrs.facing } : null,
    attrs.floor ? { label: "Floor", value: attrs.floor } : null,
    attrs.yearBuilt ? { label: "Year Built", value: attrs.yearBuilt } : null,
    listedDate ? { label: "Listed Date", value: listedDate } : null,
    { label: "Reference ID", value: `#${property.id}` },
  ].filter(Boolean);

  const amenities = buildAmenities(attrs, property);
  const lifestylePoints = buildLifestylePoints({
    attrs,
    locationInfo,
    propertyTypeLabel,
  });
  const investmentPoints = buildInvestmentPoints({
    attrs,
    propertyTypeLabel,
    isRent,
  });
  const showInvestment =
    Boolean(locationInfo.full || locationInfo.city) &&
    investmentPoints.length > 0;

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
        {/* 1. Agent brand header */}
        <header className={styles.header}>
          <Link href={agentProfileHref} className={styles.brandLink}>
            <CompanyLogo
              src={agent.company_logo}
              companyName={companyName}
            />
            <span className={styles.brandText}>
              <span className={styles.brandName}>{companyName}</span>
              <span className={styles.brandSub}>
                Listed by {agent.full_name}
              </span>
            </span>
          </Link>
          <div className={styles.headerActions}>
            <a href="#inquiry" className={styles.contactButton}>
              Contact Agent
            </a>
          </div>
        </header>

        {/* 2. Hero property media */}
        <HeroGallery images={heroImages} title={property.title} />

        {/* 3–4. Property summary + sticky agent contact */}
        <section className={styles.overview}>
          <div className={styles.overviewMain}>
            {/* 1. Property summary */}
            <article className={styles.summaryCard}>
              <p className={styles.statusLabel}>{statusLabel}</p>
              <h1 className={styles.title}>{property.title}</h1>
              {locationInfo.full ? (
                <p className={styles.locationLine}>
                  <LocationPinIcon />
                  <span>{locationInfo.full}</span>
                </p>
              ) : null}
              <p className={styles.price}>
                {formatPrice(property.price, property.price_currency)}
              </p>

              {summaryChips.length > 0 ? (
                <>
                  <hr className={styles.summaryDivider} />
                  <ul className={styles.summaryChips} aria-label="Key details">
                    {summaryChips.map((chip) => (
                      <li key={chip} className={styles.summaryChip}>
                        {chip}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </article>

            {/* 2. Property highlights */}
            {highlights.length > 0 ? (
              <section
                className={styles.contentCard}
                aria-labelledby="highlights-heading"
              >
                <p className={styles.sectionKicker}>Lifestyle</p>
                <h2 id="highlights-heading" className={styles.sectionTitle}>
                  Property Highlights
                </h2>
                <ul className={styles.highlightsGrid}>
                  {highlights.map((item) => (
                    <li key={item.id} className={styles.highlightItem}>
                      <span className={styles.highlightIcon} aria-hidden="true">
                        <HighlightIcon name={item.icon} />
                      </span>
                      <div>
                        <strong className={styles.highlightTitle}>
                          {item.title}
                        </strong>
                        <p className={styles.highlightCopy}>{item.copy}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 3. About this property */}
            {attrs.overview ? (
              <section
                className={styles.contentCard}
                aria-labelledby="about-heading"
              >
                <p className={styles.sectionKicker}>Story</p>
                <h2 id="about-heading" className={styles.sectionTitle}>
                  About This Property
                </h2>
                <ExpandableText text={attrs.overview} />
              </section>
            ) : null}

            {/* 4. Property details */}
            {detailRows.length > 0 ? (
              <section
                className={styles.contentCard}
                aria-labelledby="details-heading"
              >
                <p className={styles.sectionKicker}>Facts</p>
                <h2 id="details-heading" className={styles.sectionTitle}>
                  Property Details
                </h2>
                <dl className={styles.detailsList}>
                  {detailRows.map((row) => (
                    <div key={row.label} className={styles.detailsRow}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {/* 5. Why this home */}
            {lifestylePoints.length > 0 ? (
              <section
                className={styles.contentCard}
                aria-labelledby="why-heading"
              >
                <p className={styles.sectionKicker}>Lifestyle</p>
                <h2 id="why-heading" className={styles.sectionTitle}>
                  Why This Home?
                </h2>
                <ul className={styles.checkList}>
                  {lifestylePoints.map((point) => (
                    <li key={point} className={styles.checkItem}>
                      <span className={styles.checkMark} aria-hidden="true">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 6. Amenities */}
            {amenities.length > 0 ? (
              <section
                className={styles.contentCard}
                aria-labelledby="amenities-heading"
              >
                <p className={styles.sectionKicker}>Comfort</p>
                <h2 id="amenities-heading" className={styles.sectionTitle}>
                  Amenities
                </h2>
                <ul className={styles.amenityPills}>
                  {amenities.map((item) => (
                    <li key={item} className={styles.amenityPill}>
                      <span className={styles.amenityCheck} aria-hidden="true">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 7. Location advantage */}
            {locationInfo.full ? (
              <section
                className={styles.contentCard}
                aria-labelledby="location-adv-heading"
              >
                <p className={styles.sectionKicker}>Neighbourhood</p>
                <h2 id="location-adv-heading" className={styles.sectionTitle}>
                  Location Advantage
                </h2>
                <p className={styles.locationAdvantagePlace}>
                  {locationInfo.full}
                </p>
                <p className={styles.nearbyLabel}>Nearby</p>
                <ul className={styles.nearbyBulletList}>
                  {NEARBY_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 8. Investment insight */}
            {showInvestment ? (
              <section
                className={`${styles.contentCard} ${styles.insightCard}`}
                aria-labelledby="insight-heading"
              >
                <p className={styles.sectionKicker}>Buyer insight</p>
                <h2 id="insight-heading" className={styles.sectionTitle}>
                  Investment Insight
                </h2>
                <p className={styles.insightCopy}>
                  This property is located in a highly demanded
                  {locationInfo.city ? ` ${locationInfo.city}` : ""} residential
                  area
                  {locationInfo.area ? ` — ${locationInfo.area}` : ""}.
                </p>
                <p className={styles.insightSuitable}>Suitable for:</p>
                <ul className={styles.checkList}>
                  {investmentPoints.map((point) => (
                    <li key={point} className={styles.checkItem}>
                      <span className={styles.checkMark} aria-hidden="true">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className={styles.agentCard}>
            <div className={styles.agentBrandBlock}>
              <p className={styles.agentCompanyName}>{companyName}</p>
            </div>

            <div className={styles.agentListed}>
              <p className={styles.agentKicker}>Listed by</p>
              <div className={styles.agentTop}>
                <AgentAvatar
                  src={agent.profile_image}
                  alt={agent.full_name || "Agent"}
                  width={48}
                  height={48}
                  className={styles.agentAvatarImg}
                />
                <div>
                  <h2 className={styles.agentName}>{agent.full_name}</h2>
                  <span className={styles.verifiedBadge}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
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

            <div id="inquiry">
              <AgentInquiryForm
                propertyId={property.id}
                variant="property"
                kicker="Send Inquiry"
                heading={null}
              />
            </div>

            <p className={styles.agentNote}>
              Mention ref #{property.id} for a faster response.
            </p>
          </aside>
        </section>

        {/* Explore every space */}
        <GalleryCarousel slides={spaceSlides} title={property.title} />

        {/* Property video tour */}
        <section className={styles.videoSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionKicker}>Video Tour</p>
            <h2 className={styles.sectionTitle}>Property Video Tour</h2>
            <p className={styles.sectionLead}>
              Watch a complete tour of this property
            </p>
          </div>
          {propertyVideos.length > 0 ? (
            <PropertyVideoGallery
              videos={propertyVideos}
              poster={heroImage?.image_url || undefined}
              watermarkText={companyName}
            />
          ) : (
            <div className={styles.videoFrame}>
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
                <p className={styles.videoKicker}>Property Walkthrough</p>
                <h3 className={styles.videoTitle}>
                  Video walkthrough available on request
                </h3>
                <p className={styles.videoText}>
                  A filmed tour is not uploaded yet. Contact the agent to
                  arrange a private viewing or live walkthrough.
                </p>
                <a href="#inquiry" className={styles.videoCta}>
                  Request Viewing
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Agency branding */}
        <section className={styles.brandStory}>
          <div className={styles.brandStoryInner}>
            <CompanyLogo
              src={agent.company_logo}
              companyName={companyName}
              className={styles.brandStoryLogo}
            />
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
              <Link href={`${agentProfileHref}#agent`} className={styles.brandProfileBtn}>
                View Agent Profile
              </Link>
            </div>
          </div>
        </section>

        {/* 9. Trust */}
        <section className={styles.assurance} aria-labelledby="trust-heading">
          <div className={styles.assuranceIntro}>
            <p className={styles.sectionKicker}>Confidence</p>
            <h2 id="trust-heading" className={styles.sectionTitle}>
              Why choose this listing
            </h2>
          </div>
          <ul className={styles.assuranceGrid}>
            {TRUST_ITEMS.map((item) => (
              <li key={item} className={styles.assuranceCard}>
                <span className={styles.assuranceCheck} aria-hidden="true">
                  ✓
                </span>
                <strong>{item}</strong>
              </li>
            ))}
          </ul>
        </section>

        {/* 10. Final CTA */}
        <section className={styles.closingCta}>
          <div>
            <h2 className={styles.closingTitle}>
              Ready to visit this property?
            </h2>
          </div>
          <div className={styles.closingActions}>
            <a href="#inquiry" className={styles.contactButton}>
              Request Viewing
            </a>
            <a href="#inquiry" className={styles.closingGhost}>
              Contact Agent
            </a>
          </div>
        </section>
      </div>

      {/* Desktop FAB — hidden on mobile where sticky contact bar replaces it */}
      <div className={styles.fabDesktopOnly}>
        <AgentWhatsAppFab phone={agent.phone} message={waFabMessage} />
      </div>

      {/* Mobile sticky contact CTA — Call + WhatsApp always reachable */}
      {telHref || waHref ? (
        <nav className={styles.mobileContactBar} aria-label="Contact agent">
          {telHref ? (
            <a href={telHref} className={styles.mobileCallBtn}>
              Call Agent
            </a>
          ) : null}
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mobileWaBtn}
            >
              WhatsApp
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
