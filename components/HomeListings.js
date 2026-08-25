"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getPropertyUrl } from "@/lib/propertySlug";
import { formatPropertyLocation } from "@/lib/propertyLocation";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { formatPropertyPriceConversion } from "@/lib/formatPropertyPriceConversion";
import {
  normalizePropertySubtype,
  normalizePropertyType,
  propertySubtypeLabel,
} from "@/lib/propertyTaxonomy";
import { useIsMobile } from "@/lib/useIsMobile";
import { sanitizeSearchInput } from "@/lib/validators/common";
import {
  AGENT_PUBLIC_LISTING_GROUPS,
  listingMainSectionId,
  listingSubsectionId,
  listingSubsectionCountLabel,
  listingSubsectionTitle,
} from "@/lib/agentPublicListingSections";
import styles from "./HomeListings.module.css";

const DESKTOP_PAGE_SIZE = 3;
const MOBILE_PAGE_SIZE = 4;

const formatPrice = (price, currency) =>
  formatPropertyPrice(price, currency, { fallback: "On request" });

const formatSize = (value, unit) => {
  if (value == null || value === "") return null;
  const num = Number(value);
  const formatted = Number.isFinite(num)
    ? Number.isInteger(num)
      ? String(num)
      : String(num)
    : String(value);
  const unitLabel = unit === "sqft" ? "sqft" : unit || "";
  return `${formatted}${unitLabel ? ` ${unitLabel}` : ""}`;
};

function SizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 18V9.5A2.5 2.5 0 0 1 5.5 7H10a3 3 0 0 1 6 0h2.5A2.5 2.5 0 0 1 21 9.5V18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 14h18M3 18h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h16v2.5A3.5 3.5 0 0 1 16.5 18h-9A3.5 3.5 0 0 1 4 14.5V12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6 12V6.5A2.5 2.5 0 0 1 8.5 4H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 18v2M17 18v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Diamond marker for plot feature chips (◇). */
function FeatureIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5L20.5 12 12 20.5 3.5 12 12 3.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

function getCategory(property) {
  const stored = normalizePropertyType(
    property.property_type ||
      property.purpose ||
      property.listing_type ||
      property.category,
  );
  if (stored) return stored;

  const title = String(property.title || "").toLowerCase();
  const description = String(property.description || "").toLowerCase();

  if (title.includes("plot") || description.includes("plot")) {
    return "plot";
  }
  if (title.includes("rent") || description.includes("rent")) {
    return "rent";
  }
  if (title.includes("sale") || description.includes("sale")) {
    return "sale";
  }

  return "sale";
}

function getSubtype(property) {
  const stored = normalizePropertySubtype(property.property_subtype);
  if (stored) return stored;
  return null;
}

/** Prefer numeric field when present; otherwise null. */
function numericField(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Beds / baths from dedicated columns when present, else create-form meta
 * embedded in description (`Bedrooms: 4 | Bathrooms: 5`).
 */
function parseRoomCounts(property) {
  const fromFields = {
    beds: numericField(property.bedrooms, property.beds, property.bed_count),
    baths: numericField(
      property.bathrooms,
      property.baths,
      property.bath_count,
    ),
  };

  const text = `${property.description || ""}\n${property.title || ""}`;
  const bedsMatch =
    text.match(/Bedrooms?:\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i);
  const bathsMatch =
    text.match(/Bathrooms?:\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i);

  return {
    beds: fromFields.beds ?? (bedsMatch ? Number(bedsMatch[1]) : null),
    baths: fromFields.baths ?? (bathsMatch ? Number(bathsMatch[1]) : null),
  };
}

function formatSizeLabel(value, unit) {
  const raw = formatSize(value, unit);
  if (!raw) return null;
  return raw.replace(/\b(marla|kanal|sqft)\b/gi, (match) => {
    if (match.toLowerCase() === "sqft") return "Sqft";
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
}

/** Skip blank / placeholder agent values. */
function meaningfulLabel(value) {
  const label = String(value ?? "").trim();
  if (!label) return null;
  if (label === "-" || label === "—" || /^n\/?a$/i.test(label)) return null;
  if (/^not\s+added$/i.test(label) || /^none$/i.test(label)) return null;
  return label;
}

/**
 * Plot card chips from dedicated fields when present, else signals in
 * title/description (create form has no separate plot columns yet).
 * Returns at most two labels so Size + feature + attribute fit the row.
 */
function parsePlotFeatures(property) {
  const labels = [];
  const push = (value) => {
    const label = meaningfulLabel(value);
    if (!label) return;
    if (labels.some((item) => item.toLowerCase() === label.toLowerCase())) return;
    labels.push(label);
  };

  push(property.plot_type);
  push(property.plot_feature);
  push(property.facing);
  push(property.plot_facing);
  if (Array.isArray(property.plot_features)) {
    for (const item of property.plot_features) push(item);
  }

  const text = `${property.title || ""}\n${property.description || ""}`;

  const structuredType = text.match(/Plot\s*Type:\s*([^\n|,]+)/i);
  const structuredFacing = text.match(/Facing:\s*([^\n|,]+)/i);
  if (structuredType) push(structuredType[1]);
  if (structuredFacing) push(structuredFacing[1]);

  if (/\bcorner\b/i.test(text)) push("Corner");

  if (/\bpark[\s-]?facing\b|\bfacing\s+park\b/i.test(text)) {
    push("Park Facing");
  } else if (/\bmain\s+boulevard\b/i.test(text)) {
    push("Main Boulevard");
  } else if (/\bmain\s+road\b/i.test(text)) {
    push("Main Road");
  } else if (/\bboulevard\s+access\b|\bboulevard\b/i.test(text)) {
    push("Boulevard");
  } else if (/\bdual\s+road\b/i.test(text)) {
    push("Dual Road");
  }

  if (/\bcommercial\b/i.test(text)) {
    push("Commercial");
  } else if (/\bresidential\b/i.test(text)) {
    push("Residential");
  }

  return labels.slice(0, 2);
}

function PropertyCard({ property }) {
  const sizeLabel = formatSizeLabel(property.size_value, property.size_unit);
  const location = formatPropertyLocation(property) || "";
  const title = property.title || location || "Property";
  const category = getCategory(property);
  const isPlot = category === "plot";
  const { beds, baths } = parseRoomCounts(property);
  const plotFeatures = isPlot ? parsePlotFeatures(property) : [];
  const subtypeLabel = propertySubtypeLabel(getSubtype(property));
  const priceConversion = formatPropertyPriceConversion(
    property.price,
    property.price_currency,
  );

  return (
    <Link
      href={getPropertyUrl(property)}
      className={styles.card}
    >
      <div className={styles.media}>
        {property.featuredImage ? (
          <Image
            src={property.featuredImage.image_url}
            alt={property.title || "Property"}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className={styles.image}
          />
        ) : (
          <div className={styles.fallback} />
        )}
      </div>

      <div className={styles.body}>
        {location ? (
          <div className={styles.locationRow}>
            <span className={styles.location}>
              <LocationIcon />
              <span>{location}</span>
            </span>
          </div>
        ) : null}

        <h3 className={styles.address}>{title}</h3>

        <div className={styles.attrs}>
          {sizeLabel ? (
            <span className={styles.attr}>
              <SizeIcon />
              {sizeLabel}
            </span>
          ) : null}
          {isPlot
            ? (
                <>
                  {subtypeLabel ? (
                    <span className={styles.attr}>
                      <FeatureIcon />
                      {subtypeLabel}
                    </span>
                  ) : null}
                  {plotFeatures
                    .filter(
                      (feature) =>
                        !subtypeLabel ||
                        feature.toLowerCase() !==
                          String(subtypeLabel).toLowerCase().replace(/ plot$/i, ""),
                    )
                    .slice(0, subtypeLabel ? 1 : 2)
                    .map((feature) => (
                      <span key={feature} className={styles.attr}>
                        <FeatureIcon />
                        {feature}
                      </span>
                    ))}
                </>
              )
            : (
                <>
                  {beds != null ? (
                    <span className={styles.attr}>
                      <BedIcon />
                      {beds} {beds === 1 ? "Bed" : "Beds"}
                    </span>
                  ) : null}
                  {baths != null ? (
                    <span className={styles.attr}>
                      <BathIcon />
                      {baths} {baths === 1 ? "Bath" : "Baths"}
                    </span>
                  ) : null}
                  {subtypeLabel ? (
                    <span className={styles.attr}>
                      <FeatureIcon />
                      {subtypeLabel}
                    </span>
                  ) : null}
                </>
              )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerItem}>
            <span className={styles.footerLabel}>Price</span>
            <span className={styles.footerValue}>
              {formatPrice(property.price, property.price_currency)}
              {priceConversion ? (
                <span className={styles.footerValueConversion}>
                  {" "}
                  ({priceConversion})
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

const SWIPE_THRESHOLD_PX = 48;
const WHEEL_DELTA_MIN = 36;
const PAGINATION_SWIPE_COOLDOWN_MS = 450;

/** Horizontal swipe / trackpad scroll → prev/next page (not page scroll). */
function useListingPaginationSwipe({
  totalPages,
  currentPage,
  onPageChange,
}) {
  const areaRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const pointerStartX = useRef(null);
  const pointerStartY = useRef(null);
  const cooldownRef = useRef(false);

  const goNext = useCallback(() => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  const goPrev = useCallback(() => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const runOnce = useCallback((action) => {
    if (totalPages <= 1 || cooldownRef.current) return;
    cooldownRef.current = true;
    action();
    window.setTimeout(() => {
      cooldownRef.current = false;
    }, PAGINATION_SWIPE_COOLDOWN_MS);
  }, [totalPages]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || totalPages <= 1) return;

    const onWheel = (event) => {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX < WHEEL_DELTA_MIN || absX <= absY * 1.15) return;

      event.preventDefault();
      if (event.deltaX > 0) {
        runOnce(goNext);
      } else {
        runOnce(goPrev);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [totalPages, goNext, goPrev, runOnce]);

  const onTouchStart = (event) => {
    if (totalPages <= 1) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (event) => {
    if (
      totalPages <= 1 ||
      touchStartX.current == null ||
      touchStartY.current == null
    ) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0) {
      runOnce(goNext);
    } else {
      runOnce(goPrev);
    }
  };

  const onPointerDown = (event) => {
    if (totalPages <= 1 || event.button !== 0) return;
    pointerStartX.current = event.clientX;
    pointerStartY.current = event.clientY;
  };

  const onPointerUp = (event) => {
    if (
      totalPages <= 1 ||
      pointerStartX.current == null ||
      pointerStartY.current == null
    ) {
      return;
    }

    const deltaX = event.clientX - pointerStartX.current;
    const deltaY = event.clientY - pointerStartY.current;
    pointerStartX.current = null;
    pointerStartY.current = null;

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0) {
      runOnce(goNext);
    } else {
      runOnce(goPrev);
    }
  };

  return { areaRef, onTouchStart, onTouchEnd, onPointerDown, onPointerUp };
}

function PropertySection({
  id,
  title,
  kicker,
  subtype,
  properties,
  currentPage,
  onPageChange,
  pageSize,
}) {
  const totalPages = Math.max(1, Math.ceil(properties.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = properties.slice(startIndex, startIndex + pageSize);

  const paginationRange = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(1, safePage - 2);
    let end = start + 4;

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - 4;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };

  const { areaRef, onTouchStart, onTouchEnd, onPointerDown, onPointerUp } =
    useListingPaginationSwipe({
      totalPages,
      currentPage: safePage,
      onPageChange,
    });

  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>{kicker}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <p className={styles.count}>
          {properties.length}{" "}
          {listingSubsectionCountLabel(subtype, properties.length)}
        </p>
      </div>

      {properties.length === 0 ? (
        <div className={styles.empty}>
          No {title.toLowerCase()} match your filters. Try another area or <Link href="/agent/login">list a property</Link>.
        </div>
      ) : (
        <>
          <div
            ref={areaRef}
            className={styles.gridSwipe}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <div className={styles.grid}>
              {pageItems.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>

          {totalPages > 1 ? (
            <div className={styles.pagination}>
              {safePage > 1 ? (
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => onPageChange(safePage - 1)}
                >
                  &lt;
                </button>
              ) : null}

              {paginationRange().map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`${styles.pageButton} ${
                    page === safePage ? styles.pageButtonActive : ""
                  }`}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              ))}

              {safePage < totalPages ? (
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => onPageChange(safePage + 1)}
                >
                  &gt;
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function HomeListings({ properties = [], children }) {
  const isMobile = useIsMobile(768);
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("newest");
  const [pages, setPages] = useState({});
  const pageKey = (type, subtype) => listingSubsectionId(type, subtype);

  // Reset to page 1 when mobile/desktop page size changes so slices stay valid
  useEffect(() => {
    setPages({});
  }, [pageSize]);

  const locations = useMemo(() => {
    const set = new Set();
    for (const property of properties) {
      const display = formatPropertyLocation(property);
      if (display) set.add(display);
      const area = String(property?.area || "").trim();
      if (area) set.add(area);
    }
    return ["all", ...Array.from(set)];
  }, [properties]);

  const locationOptions = useMemo(() => {
    if (location !== "all" && !locations.includes(location)) {
      return [...locations, location];
    }
    return locations;
  }, [locations, location]);

  useEffect(() => {
    const scrollToSale = () => {
      const section = document.getElementById("for-sale");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const resetFilters = () => {
      setQuery("");
      setLocation("all");
      setSort("newest");
      setPages({});
    };

    const handleDocumentClick = (event) => {
      const target = event.target;

      const viewAll = target.closest("a[data-view-all-homes]");
      if (viewAll) {
        event.preventDefault();
        resetFilters();
        scrollToSale();
        return;
      }

      const card = target.closest("a[data-location][href='#for-sale']");
      if (!card) return;

      event.preventDefault();
      const selectedLocation = String(card.dataset.location || "").trim();
      if (!selectedLocation) return;

      setQuery("");
      setLocation(selectedLocation);
      setPages({});
      scrollToSale();
    };

    const handleResetFilters = () => {
      resetFilters();
    };

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("dhalahorePropertiesResetFilters", handleResetFilters);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("dhalahorePropertiesResetFilters", handleResetFilters);
    };
  }, []);

  useEffect(() => {
    setPages({});
  }, [query, location, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = properties.filter((p) => {
      const displayLocation = formatPropertyLocation(p) || "";
      const propertyArea = String(p.area || "").trim();
      const selected = String(location || "").trim();
      const selectedLower = selected.toLowerCase();
      const matchesLocation =
        selected === "all" ||
        displayLocation === selected ||
        (propertyArea && propertyArea.toLowerCase() === selectedLower) ||
        (selectedLower &&
          displayLocation.toLowerCase().includes(selectedLower));
      const haystack =
        `${p.title} ${displayLocation} ${p.city || ""} ${p.area || ""} ${p.phase || ""} ${p.agent_name || ""}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesLocation && matchesQuery;
    });

    const priceOf = (p) =>
      p.price != null && p.price !== "" ? Number(p.price) : null;

    if (sort === "price-asc") {
      base.sort((a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    } else if (sort === "price-desc") {
      base.sort((a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa;
      });
    } else if (sort === "newest") {
      base.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
    }

    return base;
  }, [properties, query, location, sort]);

  const groupedSections = useMemo(() => {
    return AGENT_PUBLIC_LISTING_GROUPS.map((group) => ({
      ...group,
      mainId: listingMainSectionId(group.type),
      subsections: group.subtypes.map((subtype) => ({
        subtype,
        id: listingSubsectionId(group.type, subtype),
        title: listingSubsectionTitle(subtype),
        properties: filtered.filter(
          (property) =>
            getCategory(property) === group.type &&
            getSubtype(property) === subtype,
        ),
      })),
    }));
  }, [filtered]);

  return (
    <>
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div className={styles.searchField}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M20 20l-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) =>
                setQuery(sanitizeSearchInput(e.target.value).value)
              }
              placeholder="Search by area, title or type"
              aria-label="Search listings"
            />
          </div>
          <label className={styles.selectField}>
            <span className={styles.srOnly}>Location</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Filter by location"
            >
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === "all" ? "All locations" : loc}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.selectField}>
            <span className={styles.srOnly}>Sort by price</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort listings"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.searchBtn}>
            Search
          </button>
        </div>
      </div>

      {children}

      <div className={styles.listingsWrap}>
        {groupedSections.map((group) => (
          <div
            key={group.type}
            id={group.mainId}
            className={styles.listingGroup}
          >
            {group.subsections.map((section) => {
              const key = pageKey(group.type, section.subtype);
              return (
                <PropertySection
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  kicker={group.title}
                  subtype={section.subtype}
                  properties={section.properties}
                  currentPage={pages[key] || 1}
                  pageSize={pageSize}
                  onPageChange={(page) =>
                    setPages((prev) => ({ ...prev, [key]: page }))
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
