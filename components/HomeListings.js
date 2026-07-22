"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

function AgentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c0-3 3.1-5 7-5s7 2 7 5"
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

const SORT_OPTIONS = [
  { value: "default", label: "Sort: Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest first" },
];

export default function HomeListings({ properties = [], filterType = "" }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("default");

  const locations = useMemo(() => {
    const set = new Set(properties.map((p) => p.location).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [properties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normalizedType = filterType?.toLowerCase()?.trim();

    const typeMatches = (property) => {
      if (!normalizedType) return true;

      const propertyType =
        property.property_type ||
        property.purpose ||
        property.listing_type ||
        property.category ||
        "";
      const normalizedPropertyType = String(propertyType).toLowerCase();
      const title = String(property.title || "").toLowerCase();
      const description = String(property.description || "").toLowerCase();

      if (normalizedType === "sale") {
        if (normalizedPropertyType) {
          return normalizedPropertyType.includes("sale");
        }
        const isExplicitRent = title.includes("rent") || description.includes("rent");
        const isExplicitPlot = title.includes("plot") || description.includes("plot");
        return !isExplicitRent && !isExplicitPlot;
      }

      if (normalizedType === "rent") {
        return (
          normalizedPropertyType.includes("rent") ||
          title.includes("rent") ||
          description.includes("rent")
        );
      }

      if (normalizedType === "plot") {
        return (
          normalizedPropertyType.includes("plot") ||
          title.includes("plot") ||
          description.includes("plot")
        );
      }

      return true;
    };

    const result = properties.filter((p) => {
      const matchesLocation = location === "all" || p.location === location;
      const haystack =
        `${p.title} ${p.location || ""} ${p.agent_name || ""}`.toLowerCase();
      return matchesLocation && (!q || haystack.includes(q)) && typeMatches(p);
    });

    // Listings without a price sink to the bottom for price sorts.
    const priceOf = (p) =>
      p.price != null && p.price !== "" ? Number(p.price) : null;

    if (sort === "price-asc") {
      result.sort((a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    } else if (sort === "price-desc") {
      result.sort((a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa;
      });
    } else if (sort === "newest") {
      result.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
    }

    return result;
  }, [properties, query, location, sort]);

  return (
    <section id="properties" className={styles.section}>
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

      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Homes for you</p>
          <h2 className={styles.title}>
            {filterType === "sale"
              ? "For Sale"
              : filterType === "rent"
              ? "For Rent"
              : filterType === "plot"
              ? "Plots"
              : "Featured Properties"}
          </h2>
        </div>
        <p className={styles.count}>
          {filtered.length} {filtered.length === 1 ? "home" : "homes"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          No listings match your filters. Try another area or{" "}
          <Link href="/agent/login">list a property</Link>.
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((property) => {
            const sizeLabel = formatSize(property.size_value, property.size_unit);
            const address = property.location || property.title;
            const statusLabel =
              property.status === "sold"
                ? "Sold"
                : property.status === "draft"
                  ? "Draft"
                  : "For Sale";

            return (
              <Link
                key={property.id}
                href={`/re/${property.estate_name}/${property.id}`}
                className={styles.card}
              >
                <div className={styles.media}>
                  {property.featuredImage ? (
                    <Image
                      src={property.featuredImage.image_url}
                      alt={property.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className={styles.image}
                    />
                  ) : (
                    <div className={styles.fallback} />
                  )}
                </div>

                <div className={styles.body}>
                  <h3 className={styles.address}>{address}</h3>

                  <div className={styles.attrs}>
                    {sizeLabel ? (
                      <span className={styles.attr}>
                        <SizeIcon />
                        {sizeLabel}
                      </span>
                    ) : null}
                    {property.agent_name ? (
                      <span className={styles.attr}>
                        <AgentIcon />
                        {property.agent_name}
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
                      <span className={styles.footerValue}>
                        {formatPrice(property.price)}
                      </span>
                    </div>
                    <div className={`${styles.footerItem} ${styles.footerRight}`}>
                      <span className={styles.footerLabel}>Listed by</span>
                      <span className={styles.footerValueSmall}>
                        {property.agent_name || property.estate_name || "Agent"}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
