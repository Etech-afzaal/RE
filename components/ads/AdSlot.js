"use client";

import { useEffect, useState } from "react";
import { useAd } from "@/lib/ads/client";
import {
  SCREEN_BREAKPOINTS,
  formatCodes,
  formatForScreen,
  screenForWidth,
} from "@/lib/ads/formatSets";
import { formatPropertyPrice } from "@/lib/formatPrice";
import styles from "./AdSlot.module.css";

/**
 * Drop-in ad slot for the customer site. Renders nothing when there is no ad.
 *
 *   <AdSlot placement="home_agents_top"
 *           formats={{ desktop: "leaderboard_728x90", tablet: "leaderboard_728x90",
 *                      mobile: "mobile_banner_320x100" }} />
 *   <AdSlot placement="home_agents_grid" formats="native_card_400x300" variant="card" />
 *   <AdSlot placement="blog_post" formats={BANNER_FORMATS} spacing="section" />
 *
 * Size sets live in components/ads/adFormats.js. The slot shows the size for
 * the screen: desktop ≥1024px, tablet 768–1023px, mobile ≤767px (a missing
 * tablet size uses desktop). Ads compete only if they have that size. On
 * resize/rotation the same ad switches to its other size without a new
 * request or a second impression.
 * spacing="section" – adds room above and below (for slots between page sections).
 *
 * variant="banner" – a strip sized to the format (uploaded banners show as-is,
 *                    property ads become a compact photo + text banner).
 * variant="card"   – a listing-style card that sits inside a grid.
 */
export default function AdSlot({
  formats,
  placement,
  variant = "banner",
  mobileMaxWidth = SCREEN_BREAKPOINTS.mobileMax,
  tabletMaxWidth = SCREEN_BREAKPOINTS.tabletMax,
  spacing = "default",
  className = "",
}) {
  const format = useResponsiveFormat(formats, mobileMaxWidth, tabletMaxWidth);
  const { ad, ref } = useAd(format, {
    placement,
    also: formatCodes(formats),
    enabled: Boolean(format),
  });

  if (!ad) return null;

  const Body = variant === "card" ? AdCard : AdBanner;
  const spacingClass = spacing === "section" ? styles.spaceSection : "";
  return <Body ad={ad} innerRef={ref} className={`${spacingClass} ${className}`.trim()} />;
}

// Waits until the viewport is known, so phones don't fetch a desktop ad first.
function useResponsiveFormat(formats, mobileMax, tabletMax) {
  const [format, setFormat] = useState(null);
  const single = typeof formats === "string" ? formats : null;
  const desktop = single || formats?.desktop;
  const tablet = single || formats?.tablet;
  const mobile = single || formats?.mobile;

  useEffect(() => {
    const sizes = { desktop, tablet, mobile };
    const queries = [mobileMax, tabletMax].map((max) => window.matchMedia(`(max-width: ${max}px)`));
    const sync = () =>
      setFormat(formatForScreen(sizes, screenForWidth(window.innerWidth, { mobileMax, tabletMax })));
    sync();
    queries.forEach((query) => query.addEventListener("change", sync));
    return () => queries.forEach((query) => query.removeEventListener("change", sync));
  }, [desktop, tablet, mobile, mobileMax, tabletMax]);

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
