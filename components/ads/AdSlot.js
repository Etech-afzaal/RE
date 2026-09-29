"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useAds, useImpression } from "@/lib/ads/client";
import {
  SCREEN_BREAKPOINTS,
  formatCodes,
  formatForScreen,
  screenForWidth,
} from "@/lib/ads/formatSets";
import { LOCATION_FORMATS, SLIDE_MS, getLocation } from "@/lib/ads/locations";
import { formatPropertyPrice } from "@/lib/formatPrice";
import styles from "./AdSlot.module.css";

/**
 * Drop-in ad slot for the customer site. Renders nothing when there is no ad.
 *
 *   <AdSlot location="home_above_hero" />
 *   <AdSlot location="property_before_gallery" spacing="section" />
 *
 * `location` is a key from lib/ads/locations.js; admins assign ads to it.
 * All the location's live ads show as a carousel (paid first, up to 5, one
 * every 6 seconds); a single ad shows as a plain banner.
 *
 * The slot shows the size for the screen: desktop ≥1024px, tablet 768–1023px,
 * mobile ≤767px. On resize/rotation the same ads switch to their other size
 * without a new request.
 * spacing="section" – adds room above and below (for slots between page sections).
 */
export default function AdSlot({ location, spacing = "default", className = "" }) {
  const known = Boolean(getLocation(location));
  const format = useResponsiveFormat(LOCATION_FORMATS);
  const { ads } = useAds(location, format, {
    also: formatCodes(LOCATION_FORMATS),
    enabled: Boolean(format) && known,
  });

  if (ads.length === 0) return null;
  const spacingClass = spacing === "section" ? styles.spaceSection : "";
  return <AdCarousel ads={ads} className={`${styles.slot} ${spacingClass} ${className}`.trim()} />;
}

// Waits until the viewport is known, so phones don't fetch a desktop ad first.
function useResponsiveFormat(formats) {
  const [format, setFormat] = useState(null);
  const { desktop, tablet, mobile } = formats;

  useEffect(() => {
    const { mobileMax, tabletMax } = SCREEN_BREAKPOINTS;
    const sizes = { desktop, tablet, mobile };
    const queries = [mobileMax, tabletMax].map((max) => window.matchMedia(`(max-width: ${max}px)`));
    const sync = () => setFormat(formatForScreen(sizes, screenForWidth(window.innerWidth)));
    sync();
    queries.forEach((query) => query.addEventListener("change", sync));
    return () => queries.forEach((query) => query.removeEventListener("change", sync));
  }, [desktop, tablet, mobile]);

  return format;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

// True while at least a third of the element is on screen.
function useOnScreen(ref) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.33,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

// Auto-advances every SLIDE_MS while on screen; pauses on hover, focus, a
// hidden tab or the pause button. No auto-advance with reduced motion.
function AdCarousel({ ads, className }) {
  const rootRef = useRef(null);
  const touchX = useRef(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false); // the viewer pressed pause
  const onScreen = useOnScreen(rootRef);
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion();

  const count = ads.length;
  const adsKey = ads.map((ad) => ad.id).join(",");
  const current = Math.min(index, count - 1);
  const { width } = ads[current].format;
  const autoplay = count > 1 && !stopped && !reducedMotion;

  // A new set of ads starts from the first (highest ranked) one.
  useEffect(() => setIndex(0), [adsKey]);

  useEffect(() => {
    if (!autoplay || hovered || focused || !onScreen || !pageVisible) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [autoplay, hovered, focused, onScreen, pageVisible, current, count]);

  const go = (next) => setIndex((next + count) % count);
  const many = count > 1;

  return (
    <div className={className}>
      <section
        ref={rootRef}
        className={styles.carousel}
        style={{ maxWidth: Math.max(width, 320) }}
        aria-roledescription={many ? "carousel" : undefined}
        aria-label={many ? "Sponsored listings" : ads[0].isFeatured ? "Featured listing" : "Promotion"}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
        }}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowLeft") go(current - 1);
          if (e.key === "ArrowRight") go(current + 1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null || !many) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
        }}
      >
        <div className={styles.stage}>
          <div className={styles.viewport}>
            <div
              className={`${styles.track} ${reducedMotion ? styles.trackStill : ""}`}
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {ads.map((ad, i) => (
                <Slide
                  key={ad.id}
                  ad={ad}
                  active={i === current}
                  label={many ? `${i + 1} of ${count}` : undefined}
                />
              ))}
            </div>
          </div>

          {many && (
            <>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowPrev}`}
                onClick={() => go(current - 1)}
                aria-label="Previous ad"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.arrow} ${styles.arrowNext}`}
                onClick={() => go(current + 1)}
                aria-label="Next ad"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {many && (
          <div className={styles.controls}>
            {!reducedMotion && (
              <button
                type="button"
                className={styles.pause}
                onClick={() => setStopped((value) => !value)}
                aria-label={stopped ? "Play ads" : "Pause ads"}
              >
                {stopped ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
              </button>
            )}
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
                onClick={() => go(i)}
                aria-label={`Show ad ${i + 1} of ${count}`}
                aria-current={i === current ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// One ad. Its impression only counts while it's the slide on screen: hidden
// slides are clipped by the carousel, so the observer never sees them.
function Slide({ ad, active, label }) {
  const ref = useImpression(ad);
  const tabIndex = active ? undefined : -1;
  return (
    <div
      ref={ref}
      className={styles.slide}
      role={label ? "group" : undefined}
      aria-roledescription={label ? "slide" : undefined}
      aria-label={label}
      aria-hidden={active ? undefined : "true"}
    >
      {ad.creativeType === "image" ? (
        <ImageBanner ad={ad} tabIndex={tabIndex} />
      ) : (
        <PropertyBanner ad={ad} tabIndex={tabIndex} />
      )}
    </div>
  );
}

function linkProps(ad, tabIndex) {
  return {
    href: ad.clickUrl ?? undefined,
    target: ad.opensNewTab ? "_blank" : undefined,
    rel: [ad.isFeatured ? "sponsored" : null, "noopener"].filter(Boolean).join(" "),
    tabIndex,
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

// An uploaded banner made for this size — shown as-is.
function ImageBanner({ ad, tabIndex }) {
  const { width, height } = ad.format;
  return (
    <a {...linkProps(ad, tabIndex)} className={styles.bannerImageLink} style={{ maxWidth: width }}>
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
          {ad.isFeatured && (
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "0.01rem",
                color: "#000103",
                fontSize: "0.6rem",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              Sponsored Ad
            </span>
          )}
        </span>
      )}
    </a>
  );
}

// No uploaded banner: a compact photo + text strip built from the property.
function PropertyBanner({ ad, tabIndex }) {
  const meta = propertyMeta(ad.property);
  const amount = price(ad.property);
  return (
    <a
      {...linkProps(ad, tabIndex)}
      className={styles.composedBanner}
      style={{ maxWidth: Math.max(ad.format.width, 320) }}
    >
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.imageUrl} alt={ad.altText} className={styles.composedImage} loading="lazy" />
      )}
      <span className={styles.composedBody}>
        {ad.label && <span className={styles.label}>{ad.label}</span>}
        <span className={styles.composedTitle}>{ad.headline}</span>
        {(meta || amount) && (
          <span className={styles.composedMeta}>{[meta, amount].filter(Boolean).join(" · ")}</span>
        )}
      </span>
      {ad.ctaText && (
        <span className={styles.cta} style={{ position: "relative" }}>
          {ad.ctaText}
          {ad.isFeatured && (
            <span
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "0.2rem",
                color: "#6b7280",
                fontSize: "0.7rem",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              Sponsored Ad
            </span>
          )}
        </span>
      )}
    </a>
  );
}
