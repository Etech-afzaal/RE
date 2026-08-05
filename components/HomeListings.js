"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { propertyPublicPath } from "@/lib/propertySlug";
import styles from "./HomeListings.module.css";

const formatPrice = (price) =>
  price ? `PKR ${Number(price).toLocaleString()}` : "On request";

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

function StatusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
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
  { value: "default", label: "Price" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest first" },
];

function getCategory(property) {
  const type =
    String(property.property_type || property.purpose || property.listing_type || property.category || "")
      .toLowerCase();
  const title = String(property.title || "").toLowerCase();
  const description = String(property.description || "").toLowerCase();

  if (type.includes("plot") || title.includes("plot") || description.includes("plot")) {
    return "plot";
  }
  if (type.includes("rent") || title.includes("rent") || description.includes("rent")) {
    return "rent";
  }
  if (type.includes("sale")) {
    return "sale";
  }

  const isExplicitRent = title.includes("rent") || description.includes("rent");
  const isExplicitPlot = title.includes("plot") || description.includes("plot");
  if (isExplicitPlot) return "plot";
  if (isExplicitRent) return "rent";
  return "sale";
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

function PropertyCard({ property }) {
  const sizeLabel = formatSizeLabel(property.size_value, property.size_unit);
  const location = String(property.location || "").trim();
  const title = property.title || location || "Property";
  const category = getCategory(property);
  const { beds, baths } = parseRoomCounts(property);
  const statusLabel =
    property.status === "sold"
      ? "Sold"
      : property.status === "draft"
        ? "Draft"
        : category === "rent"
          ? "For Rent"
          : category === "plot"
            ? "Plot"
            : "For Sale";

  return (
    <Link
      href={propertyPublicPath(null, property)}
      className={styles.card}
    >
      <div className={styles.media}>
        {property.featuredImage ? (
          <Image
            src={property.featuredImage.image_url}
            alt={property.title || "Property"}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
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
          <span className={styles.attr}>
            <StatusIcon />
            {statusLabel}
          </span>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerItem}>
            <span className={styles.footerLabel}>Price</span>
            <span className={styles.footerValue}>{formatPrice(property.price)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PropertySection({ id, title, kicker, properties, currentPage, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(properties.length / 3));
  const startIndex = (currentPage - 1) * 3;
  const pageItems = properties.slice(startIndex, startIndex + 3);

  const paginationRange = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(1, currentPage - 2);
    let end = start + 4;

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - 4;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };

  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>{kicker}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <p className={styles.count}>
          {properties.length} {properties.length === 1 ? "home" : "homes"}
        </p>
      </div>

      {properties.length === 0 ? (
        <div className={styles.empty}>
          No {title.toLowerCase()} match your filters. Try another area or <Link href="/agent/login">list a property</Link>.
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {pageItems.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className={styles.pagination}>
              {currentPage > 1 ? (
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => onPageChange(currentPage - 1)}
                >
                  &lt;
                </button>
              ) : null}

              {paginationRange().map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`${styles.pageButton} ${
                    page === currentPage ? styles.pageButtonActive : ""
                  }`}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              ))}

              {currentPage < totalPages ? (
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => onPageChange(currentPage + 1)}
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

export default function HomeListings({ properties = [] }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("default");
  const [pages, setPages] = useState({ sale: 1, rent: 1, plot: 1 });

  const locations = useMemo(() => {
    const set = new Set(properties.map((p) => p.location).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [properties]);

  useEffect(() => {
    const scrollToSale = () => {
      const section = document.getElementById("sale");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const resetFilters = () => {
      setQuery("");
      setLocation("all");
      setSort("default");
      setPages({ sale: 1, rent: 1, plot: 1 });
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

      const card = target.closest("a[data-location][href='#sale']");
      if (!card) return;

      event.preventDefault();
      const selectedLocation = card.dataset.location;
      if (!selectedLocation) return;

      setLocation(selectedLocation);
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
    setPages({ sale: 1, rent: 1, plot: 1 });
  }, [query, location, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = properties.filter((p) => {
      const matchesLocation = location === "all" || p.location === location;
      const haystack = `${p.title} ${p.location || ""} ${p.agent_name || ""}`.toLowerCase();
      return matchesLocation && (!q || haystack.includes(q));
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

  const saleProperties = useMemo(
    () => filtered.filter((property) => getCategory(property) === "sale"),
    [filtered],
  );

  const rentProperties = useMemo(
    () => filtered.filter((property) => getCategory(property) === "rent"),
    [filtered],
  );

  const plotProperties = useMemo(
    () => filtered.filter((property) => getCategory(property) === "plot"),
    [filtered],
  );

  return (
    <div>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by area, title, or agent"
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
            {locations.map((loc) => (
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

      <PropertySection
        id="sale"
        title="For Sale"
        kicker="Homes for sale"
        properties={saleProperties}
        currentPage={pages.sale}
        onPageChange={(page) => setPages((prev) => ({ ...prev, sale: page }))}
      />

      <PropertySection
        id="rent"
        title="For Rent"
        kicker="Homes for rent"
        properties={rentProperties}
        currentPage={pages.rent}
        onPageChange={(page) => setPages((prev) => ({ ...prev, rent: page }))}
      />

      <PropertySection
        id="plots"
        title="Plots"
        kicker="Land listings"
        properties={plotProperties}
        currentPage={pages.plot}
        onPageChange={(page) => setPages((prev) => ({ ...prev, plot: page }))}
      />

    </div>
  );
}
