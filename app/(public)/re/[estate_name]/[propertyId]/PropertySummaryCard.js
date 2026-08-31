import Image from "next/image";
import ExpandableText from "./ExpandableText";
import styles from "./PropertySummaryCard.module.css";

/**
 * Build a single location line: address, phase, area, city.
 * Skips empty values and avoids stray commas.
 */
function formatSummaryLocation({ address, phase, area, city }) {
  return [address, area, phase, city]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function formatParkingLabel(parking) {
  if (parking == null) return null;
  const count = Number(parking);
  if (Number.isNaN(count)) return String(parking);
  return count > 0 ? "Yes" : "No";
}

/** Strip trailing Bedrooms | Bathrooms | Parking meta from description text. */
function stripPropertyMetaFromDescription(text) {
  const content = String(text || "").trim();
  if (!content) return null;

  const cleaned = content
    .replace(
      /\n*\s*Bedrooms?:\s*\d+(?:\s*\|\s*Bathrooms?:\s*\d+)?(?:\s*\|\s*Parking:\s*(?:\d+|Yes|No))?\s*$/i,
      "",
    )
    .replace(
      /\n*\s*Bedrooms?:\s*\d+\s*\|\s*Bathrooms?:\s*\d+\s*\|\s*Parking:\s*(?:Yes|No|\d+)\s*$/i,
      "",
    )
    .trim();

  return cleaned || null;
}

function parseParkingFromDescription(text) {
  const match = String(text || "").match(/Parking:\s*(Yes|No|\d+)/i);
  if (!match) return null;
  const raw = match[1];
  if (/^yes$/i.test(raw)) return "Yes";
  if (/^no$/i.test(raw)) return "No";
  const count = Number(raw);
  if (Number.isNaN(count)) return raw;
  return count > 0 ? "Yes" : "No";
}

function LocationPinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={styles.iconGold}
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

function HomeTypeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12.5 12.5 20 4 11.5V4h7.5L20 12.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 18V9.5A2.5 2.5 0 0 1 5.5 7H10a3 3 0 0 1 6 0h2.5A2.5 2.5 0 0 1 21 9.5V18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 14h18M3 18h18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h16v2.5A3.5 3.5 0 0 1 16.5 18h-9A3.5 3.5 0 0 1 4 14.5V12z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6 12V6.5A2.5 2.5 0 0 1 8.5 4H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7 18v2M17 18v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 15.5h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M6.5 15.5V12.8l1.7-4.5a2 2 0 0 1 1.9-1.3h4.8a2 2 0 0 1 1.9 1.3l1.7 4.5v2.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 11h5.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="8" cy="15.5" r="1.65" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="15.5" r="1.65" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 10h4M14 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Premium summary below the hero: square featured image + title / location /
 * price / description / type-status cards / bottom stats row.
 */
export default function PropertySummaryCard({
  title,
  imageUrl,
  imageAlt,
  address,
  phase,
  area,
  city,
  priceLabel,
  description,
  propertyType,
  status,
  sizeLabel,
  bedrooms,
  bathrooms,
  parking,
  referenceId,
  listedAt,
  className,
}) {
  const locationLine = formatSummaryLocation({ address, phase, area, city });
  const cleanDescription = stripPropertyMetaFromDescription(description);
  const parkingLabel =
    formatParkingLabel(parking) ?? parseParkingFromDescription(description);
  const compactPropertyType = ["apartment", "commercial", "residential"].includes(
    String(propertyType || "").trim().toLowerCase(),
  );

  const stats = [
    sizeLabel ? { label: "Size", value: sizeLabel, Icon: SizeIcon } : null,
    bedrooms != null
      ? { label: "Bedrooms", value: String(bedrooms), Icon: BedIcon }
      : null,
    bathrooms != null
      ? { label: "Bathrooms", value: String(bathrooms), Icon: BathIcon }
      : null,
    parkingLabel
      ? {
          label: "Parking",
          value: parkingLabel,
          Icon: CarIcon,
          iconClass: styles.statIconLarge,
        }
      : null,
    referenceId
      ? { label: "Reference ID", value: referenceId, Icon: IdIcon }
      : null,
  ].filter(Boolean);

  return (
    <article
      className={`${styles.card} ${className || ""}`.trim()}
      aria-labelledby="property-summary-title"
    >
      <div className={styles.main}>
        <div className={styles.media}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt || title || "Property"}
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className={styles.mediaImage}
            />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true" />
          )}
        </div>

        <div className={styles.body}>
          <h1 id="property-summary-title" className={styles.title}>
            {title}
          </h1>

          {listedAt ? (
            <p className={styles.listedAt}>
              <span className={styles.listedAtLabel}>Listed At:</span>
              <span className={styles.listedAtValue}>{listedAt}</span>
            </p>
          ) : null}

          {locationLine ? (
            <p className={styles.locationLine}>
              <LocationPinIcon />
              <span>{locationLine}</span>
            </p>
          ) : null}

          {priceLabel ? <p className={styles.price}>{priceLabel}</p> : null}

          {cleanDescription ? (
            <div className={styles.description}>
              <ExpandableText text={cleanDescription} />
            </div>
          ) : null}

          {(propertyType || status) ? (
            <div className={styles.topCards}>
              {propertyType ? (
                <div className={styles.topCard}>
                  <span className={styles.topCardIcon} aria-hidden="true">
                    <HomeTypeIcon />
                  </span>
                  <div className={styles.topCardCopy}>
                    <span className={styles.topCardLabel}>Property Type</span>
                    <span
                      className={`${styles.topCardValue} ${styles.propertyTypeValue} ${
                        compactPropertyType ? styles.compactPropertyTypeValue : ""
                      }`.trim()}
                    >
                      {propertyType}
                    </span>
                  </div>
                </div>
              ) : null}
              {status ? (
                <div className={styles.topCard}>
                  <span className={styles.topCardIcon} aria-hidden="true">
                    <TagIcon />
                  </span>
                  <div className={styles.topCardCopy}>
                    <span className={styles.topCardLabel}>Listing Status</span>
                    <span className={styles.topCardValue}>{status}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {stats.length > 0 ? (
        <>
          <hr className={styles.divider} />
          <dl className={styles.statsRow} aria-label="Property statistics">
            {stats.map((item, index) => (
              <div
                key={item.label}
                className={`${styles.statItem} ${index > 0 ? styles.statItemDivider : ""}`.trim()}
              >
                <span
                  className={`${styles.statIcon} ${item.iconClass || ""}`.trim()}
                  aria-hidden="true"
                >
                  <item.Icon />
                </span>
                <div className={styles.statCopy}>
                  <dt className={styles.statLabel}>{item.label}</dt>
                  <dd className={styles.statValue}>{item.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </article>
  );
}
