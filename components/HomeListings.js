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

function HeartIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s-6.5-4.35-9.3-8.2C.7 10.1 1.4 6.5 4.4 5.1c1.9-.9 4.1-.3 5.4 1.3C11.1 4.8 13.3 4.2 15.2 5.1c3 1.4 3.7 5 1.7 7.7C18.5 16.65 12 21 12 21z"
        fill={filled ? "#f2bb46" : "none"}
        stroke={filled ? "#c9961f" : "#9ca3af"}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomeListings({ properties = [] }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [saved, setSaved] = useState(() => new Set());

  const locations = useMemo(() => {
    const set = new Set(properties.map((p) => p.location).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [properties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      const matchesLocation = location === "all" || p.location === location;
      const haystack =
        `${p.title} ${p.location || ""} ${p.agent_name || ""}`.toLowerCase();
      return matchesLocation && (!q || haystack.includes(q));
    });
  }, [properties, query, location]);

  const toggleSaved = (id, event) => {
    event.preventDefault();
    event.stopPropagation();
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section id="listings" className={styles.section}>
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
        <button type="button" className={styles.searchBtn}>
          Search
        </button>
      </div>

      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Homes for you</p>
          <h2 className={styles.title}>Featured listings</h2>
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
            const isSaved = saved.has(property.id);

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
                  <button
                    type="button"
                    className={styles.favBtn}
                    aria-label={isSaved ? "Remove from saved" : "Save property"}
                    aria-pressed={isSaved}
                    onClick={(e) => toggleSaved(property.id, e)}
                  >
                    <HeartIcon filled={isSaved} />
                  </button>
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
