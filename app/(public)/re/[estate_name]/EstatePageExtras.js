"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./EstatePageExtras.module.css";

const formatPrice = (price) =>
  price ? `PKR ${Number(price).toLocaleString()}` : "Price on request";

export function PropertySection({ properties, estateName }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = properties.filter((property) => {
      if (!normalizedSearch) return true;
      return [property.title, property.location, property.size_unit]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });

    const sorted = [...result];
    if (sort === "price-asc") {
      return sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sort === "price-desc") {
      return sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return sorted.sort((a, b) => Number(b.id) - Number(a.id));
  }, [properties, search, sort]);

  return (
    <div className={styles.sectionShell}>
      <div className={styles.sectionFilters}>
        <div className={styles.filterGroup}>
          <p className={styles.filterLabel}>Filter properties</p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, location, or size"
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="sort" className={styles.filterLabel}>
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={styles.filterSelect}
          >
            <option value="newest">Newest listings</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <div className={styles.sectionSummary}>
        <p className={styles.emptyText}>
          Showing {filteredProperties.length} of {properties.length} listings
        </p>
        <p className={styles.emptyText}>
          Search by name, location, or size unit for fast results.
        </p>
      </div>

      {filteredProperties.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No listings match your search. Adjust the filters or check back
            soon.
          </p>
        </div>
      ) : (
        <div className={styles.propertiesGrid}>
          {filteredProperties.map((property) => (
            <Link
              key={property.id}
              href={`/re/${estateName}/${property.id}`}
              className={styles.propertyCard}
            >
              <div className={styles.propertyImageWrapper}>
                {property.featuredImage ? (
                  <img
                    src={property.featuredImage.image_url}
                    alt={property.title}
                    className={styles.propertyImage}
                  />
                ) : property.images[0] ? (
                  <img
                    src={property.images[0].image_url}
                    alt={property.title}
                    className={styles.propertyImage}
                  />
                ) : (
                  <div className={styles.propertyFallback} />
                )}
              </div>
              <div className={styles.propertyContent}>
                <span className={styles.propertyTag}>Property listing</span>
                <h2 className={styles.propertyTitle}>{property.title}</h2>
                <p className={styles.propertyText}>
                  {property.location || "Location not specified"}
                </p>
                <div className={styles.propertyMeta}>
                  {property.size_value ? (
                    <span>
                      {property.size_value} {property.size_unit}
                    </span>
                  ) : null}
                  <span className={styles.propertyPrice}>
                    {formatPrice(property.price)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactSection({ agent }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estate_name: agent.estate_name,
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to send your message.");
      }

      setStatus("sent");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err.message || "Unable to send your message.");
      setStatus("error");
    }
  };

  return (
    <section id="contact" className={styles.contactSection}>
      <div className={styles.contactGrid}>
        <div className={styles.contactInfo}>
          <p className={styles.contactIntro}>Contact the agent</p>
          <h2 className={styles.contactTitle}>
            Reach out to {agent.full_name} for a viewing or price details.
          </h2>
          <p className={styles.contactText}>
            Share your preferred budget and schedule, and the agent will get
            back to you soon.
          </p>

          <form onSubmit={handleSubmit} className={styles.contactForm}>
            <input
              type="text"
              required
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Your name"
              className={styles.contactInput}
            />
            <input
              type="email"
              required
              value={form.email}
              onChange={handleChange("email")}
              placeholder="Your email"
              className={styles.contactInput}
            />
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="Your phone"
              className={styles.contactInput}
            />
            <textarea
              required
              value={form.message}
              onChange={handleChange("message")}
              placeholder="Tell us what you're looking for"
              rows={5}
              className={`${styles.contactInput} ${styles.contactTextarea}`}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className={styles.contactButton}
            >
              {status === "sending"
                ? "Sending..."
                : status === "sent"
                  ? "Message sent"
                  : "Send message"}
            </button>
            {error && <p className={styles.contactStatus}>{error}</p>}
            {status === "sent" && !error && (
              <p className={styles.contactSuccessText}>
                Your message has been sent to the agent.
              </p>
            )}
          </form>

          {status === "sent" && !error && (
            <div className={styles.successOverlay}>
              <div className={styles.successContent}>
                <p className={styles.successTitle}>Thank you!</p>
                <p className={styles.successMessage}>
                  Your message has been sent to {agent.full_name}. They will
                  reach out soon.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setError("");
                  }}
                  className={styles.successButton}
                >
                  Send another message
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.contactVisual}>
          <img
            src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80"
            alt="Real estate agent working with clients"
            className={styles.contactVisualImage}
          />
        </div>
      </div>
    </section>
  );
}
