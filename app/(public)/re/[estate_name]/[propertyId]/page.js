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

/* Representative interiors shown while listings only carry a few photos.
   These live in /public/uploads and are clearly labelled in the UI. */
const SPACE_HIGHLIGHTS = [
  {
    label: "TV lounge",
    copy: "A formal lounge with statement lighting and a marble feature wall — made for entertaining.",
    image: "/uploads/34/7voS1CO2Ul.jpg",
  },
  {
    label: "Bedroom suite",
    copy: "Generous bedrooms with textured feature walls and abundant natural light.",
    image: "/uploads/35/12WxQOKJvw.jpg",
  },
  {
    label: "Designer bathroom",
    copy: "Spa-style bath with jacuzzi tub, walk-in rain shower and imported fittings.",
    image: "/uploads/34/kRjDW2M7LD.jpg",
  },
  {
    label: "Powder room",
    copy: "Stone vanities and warm wood detailing carry the finish into every corner.",
    image: "/uploads/33/orC6c7J2p5.jpg",
  },
  {
    label: "Grand gallery",
    copy: "A double-height gallery crowned with chandeliers connects the living floors.",
    image: "/uploads/32/lClwoFcK15.jpg",
  },
  {
    label: "Evening elevation",
    copy: "Architectural facade lighting gives the home real presence after dark.",
    image: "/uploads/34/lulJb0e94y.jpg",
  },
];

const ASSURANCES = [
  {
    title: "Verified agent",
    copy: "Every agent on Dhalahore is manually approved before they can list.",
  },
  {
    title: "Direct contact",
    copy: "Your inquiry goes straight to the listing agent — no middlemen.",
  },
  {
    title: "Viewings arranged",
    copy: "Schedule a private visit at a time that suits you.",
  },
];

export default async function PropertyDetailPage({ params }) {
  const agent = await getAgentByEstateName(params.estate_name);
  if (!agent) return notFound();

  const property = await getPropertyById(Number(params.propertyId));
  if (!property || property.agent_id !== agent.id) return notFound();

  const sizeLabel = formatSize(property.size_value, property.size_unit);
  const listedDate = formatDate(property.created_at);
  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "draft"
        ? "Draft"
        : "For Sale";

  const gallery = property.images || [];
  const heroImage = property.featuredImage || gallery[0] || null;
  const sideImages = gallery
    .filter((img) => img.id !== heroImage?.id)
    .slice(0, 2);

  const inquiryHref = `mailto:${agent.email}?subject=${encodeURIComponent(
    `Inquiry — ${property.title} (Ref #${property.id})`,
  )}`;
  const viewingHref = `mailto:${agent.email}?subject=${encodeURIComponent(
    `Viewing request — ${property.title} (Ref #${property.id})`,
  )}`;
  const telHref = agent.phone ? `tel:${agent.phone.replace(/\s/g, "")}` : null;

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
                width={144}
                height={40}
              />
            </Link>
          </div>
          <div className={styles.headerActions}>
            <a href={inquiryHref} className={styles.contactButton}>
              Contact agent
            </a>
          </div>
        </header>

        {/* Hero mosaic — photos straight from the listing */}
        <section className={styles.heroMosaic} aria-label="Property photos">
          <div className={styles.mosaicMain}>
            {heroImage ? (
              <Image
                src={heroImage.image_url}
                alt={heroImage.image_title || property.title}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 66vw"
                className={styles.mosaicImage}
              />
            ) : (
              <div className={styles.mosaicFallback} />
            )}
            <span className={styles.photoCount}>
              {gallery.length} {gallery.length === 1 ? "photo" : "photos"}
            </span>
          </div>
          <div className={styles.mosaicSide}>
            {sideImages.map((img) => (
              <div key={img.id} className={styles.mosaicTile}>
                <Image
                  src={img.image_url}
                  alt={img.image_title || property.title}
                  fill
                  sizes="(max-width: 900px) 50vw, 33vw"
                  className={styles.mosaicImage}
                />
              </div>
            ))}
            {sideImages.length === 0 ? (
              <div className={`${styles.mosaicTile} ${styles.mosaicFallback}`} />
            ) : null}
          </div>
        </section>

        {/* Title + facts */}
        <section className={styles.overview}>
          <div className={styles.overviewMain}>
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

            <div className={styles.factRow}>
              {sizeLabel ? (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Plot size</span>
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
              {listedDate ? (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Listed on</span>
                  <strong>{listedDate}</strong>
                </div>
              ) : null}
            </div>

            {property.description ? (
              <div className={styles.description}>
                <p className={styles.sectionKicker}>The story</p>
                <h2 className={styles.sectionTitle}>About this home</h2>
                <p className={styles.descriptionText}>
                  {property.description}
                </p>
              </div>
            ) : null}
          </div>

          {/* Agent card */}
          <aside className={styles.agentCard}>
            <div className={styles.agentTop}>
              <div className={styles.agentAvatar} aria-hidden="true">
                {agent.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div>
                <p className={styles.agentKicker}>Listed by</p>
                <h2 className={styles.agentName}>{agent.full_name}</h2>
                <p className={styles.agentRole}>{agent.estate_name}</p>
              </div>
            </div>

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
              Verified Dhalahore agent
            </span>

            <div className={styles.agentDetails}>
              <a href={`mailto:${agent.email}`} className={styles.agentDetail}>
                <span>Email</span>
                <strong>{agent.email}</strong>
              </a>
              {agent.phone ? (
                <a href={telHref} className={styles.agentDetail}>
                  <span>Phone</span>
                  <strong>{agent.phone}</strong>
                </a>
              ) : null}
            </div>

            <div className={styles.agentActions}>
              <a href={viewingHref} className={styles.agentPrimary}>
                Request a viewing
              </a>
              <a href={inquiryHref} className={styles.agentSecondary}>
                Ask a question
              </a>
            </div>

            <p className={styles.agentNote}>
              Mention ref #{property.id} for a faster response.
            </p>
          </aside>
        </section>

        {/* Explore the spaces — listing photos + room highlights in one swipeable rail */}
        <GalleryCarousel
          slides={[
            ...gallery.map((img) => ({
              id: `db-${img.id}`,
              image: img.image_url,
              label: img.image_title || property.title,
              copy: null,
            })),
            ...SPACE_HIGHLIGHTS.map((space, index) => ({
              id: `space-${index}`,
              image: space.image,
              label: space.label,
              copy: space.copy,
            })),
          ]}
          title={property.title}
        />

        {/* Video tour placeholder */}
        <section className={styles.videoSection}>
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
              <p className={styles.videoKicker}>Video walkthrough</p>
              <h2 className={styles.videoTitle}>Cinematic tour coming soon</h2>
              <p className={styles.videoText}>
                We&apos;re filming this home. Until then, the agent will gladly
                walk you through it — live on a call or in person.
              </p>
              <a href={viewingHref} className={styles.videoCta}>
                Book a live tour
              </a>
            </div>
          </div>
        </section>

        {/* Assurance strip */}
        <section className={styles.assurance}>
          {ASSURANCES.map((item) => (
            <div key={item.title} className={styles.assuranceCard}>
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
            </div>
          ))}
        </section>

        {/* Closing CTA */}
        <section className={styles.closingCta}>
          <div>
            <p className={styles.closingKicker}>Ready when you are</p>
            <h2 className={styles.closingTitle}>
              Picture your life at {property.location || "this address"}
            </h2>
          </div>
          <div className={styles.closingActions}>
            <a href={viewingHref} className={styles.contactButton}>
              Request a viewing
            </a>
            <Link href="/#listings" className={styles.closingGhost}>
              Browse more homes
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
