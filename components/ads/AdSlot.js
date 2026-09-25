"use client";

import { useEffect, useState } from "react";
import { useAd } from "@/lib/ads/client";
import { formatPropertyPrice } from "@/lib/formatPrice";
import styles from "./AdSlot.module.css";

/**
 * Drop-in ad slot for the customer site. Renders nothing when there is no ad.
 *
 *   <AdSlot placement="home_agents_top"
 *           formats={{ desktop: "leaderboard_728x90", mobile: "mobile_banner_320x100" }} />
 *   <AdSlot placement="home_agents_grid" formats="native_card_400x300" variant="card" />
 *
 * variant="banner" – a strip sized to the format (uploaded banners show as-is,
 *                    property ads become a compact photo + text banner).
 * variant="card"   – a listing-style card that sits inside a grid.
 */
export default function AdSlot({
  formats,
  placement,
  variant = "banner",
  mobileMaxWidth = 768,
  className = "",
}) {
  const format = useResponsiveFormat(formats, mobileMaxWidth);
  const { ad, ref } = useAd(format, { placement, enabled: Boolean(format) });

  if (!ad) return null;

  const Body = variant === "card" ? AdCard : AdBanner;
  return <Body ad={ad} innerRef={ref} className={className} />;
}

// Waits until the viewport is known, so phones don't fetch a desktop ad first.
function useResponsiveFormat(formats, mobileMaxWidth) {
  const [format, setFormat] = useState(null);
  const desktop = typeof formats === "string" ? formats : formats?.desktop;
  const mobile = typeof formats === "string" ? formats : formats?.mobile || desktop;

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${mobileMaxWidth}px)`);
    const sync = () => setFormat(query.matches ? mobile : desktop);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [desktop, mobile, mobileMaxWidth]);

  return format;
}

function linkProps(ad) {
  return {
    href: ad.clickUrl ?? undefined,
    target: ad.opensNewTab ? "_blank" : undefined,
    rel: [ad.isFeatured ? "sponsored" : null, "noopener"].filter(Boolean).join(" "),
  };
}

function propertyMeta(property) {
  if (!property) return null;
  return [property.location, property.size].filter(Boolean).join(" · ");
}

function price(property) {
  if (!property || property.price == null) return null;
  return formatPropertyPrice(property.price, property.priceCurrency, { fallback: null });
}

function Label({ ad }) {
  return ad.label ? <span className={styles.label}>{ad.label}</span> : null;
}

function AdBanner({ ad, innerRef, className }) {
  const { width, height } = ad.format;

  if (ad.creativeType === "image") {
    return (
      <aside
        ref={innerRef}
        className={`${styles.bannerSlot} ${className}`}
        aria-label={ad.isFeatured ? "Featured listing" : "Promotion"}
      >
        <a {...linkProps(ad)} className={styles.bannerImageLink} style={{ maxWidth: width }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.altText}
            width={width}
            height={height}
            className={styles.bannerImage}
            loading="lazy"
          />
          {/* Small corner overlays so they don't cover the middle of the artwork. */}
          {ad.label && <span className={styles.badge}>{ad.label}</span>}
          {ad.ctaText && (
            <span className={styles.bannerCta} aria-hidden="true">
              {ad.ctaText}
            </span>
          )}
        </a>
      </aside>
    );
  }

  // No uploaded banner: a compact photo + text strip instead of a cropped photo.
  const meta = propertyMeta(ad.property);
  const amount = price(ad.property);
  return (
    <aside
      ref={innerRef}
      className={`${styles.bannerSlot} ${className}`}
      aria-label={ad.isFeatured ? "Featured listing" : "Promotion"}
    >
      <a {...linkProps(ad)} className={styles.composedBanner} style={{ maxWidth: Math.max(width, 320) }}>
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={ad.altText} className={styles.composedImage} loading="lazy" />
        )}
        <span className={styles.composedBody}>
          <Label ad={ad} />
          <span className={styles.composedTitle}>{ad.headline}</span>
          {(meta || amount) && (
            <span className={styles.composedMeta}>
              {[meta, amount].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        {ad.ctaText && <span className={styles.cta}>{ad.ctaText}</span>}
      </a>
    </aside>
  );
}

function AdCard({ ad, innerRef, className }) {
  const meta = propertyMeta(ad.property);
  const amount = price(ad.property);
  return (
    // Mirrors the agent card layout (text left, photo right, button below) so
    // it sits in the agents grid without stretching its row.
    <a
      ref={innerRef}
      {...linkProps(ad)}
      className={`${styles.card} ${className}`}
      aria-label={`${ad.isFeatured ? "Featured: " : ""}${ad.headline || ad.altText}`}
    >
      <span className={styles.cardContent}>
        <span className={styles.cardBody}>
          {ad.property?.agentName && (
            <span className={styles.cardKicker}>{ad.property.agentName}</span>
          )}
          <span className={styles.cardTitle}>{ad.headline}</span>
          {meta && <span className={styles.cardMeta}>{meta}</span>}
          {amount && <span className={styles.cardPrice}>{amount}</span>}
        </span>
        <span className={styles.cardMedia}>
          {ad.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt={ad.altText} className={styles.cardImage} loading="lazy" />
          )}
          {ad.label && <span className={styles.badge}>{ad.label}</span>}
        </span>
      </span>
      {ad.ctaText && <span className={`${styles.cta} ${styles.cardCta}`}>{ad.ctaText}</span>}
    </a>
  );
}
