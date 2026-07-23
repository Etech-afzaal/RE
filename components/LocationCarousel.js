"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "@/app/page.module.css";

export default function LocationCarousel({ locations = [] }) {
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [locations, updateArrows]);

  const scrollByCard = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector(`.${styles.locationCard}`);
    const amount = card ? card.getBoundingClientRect().width + 18 : el.clientWidth * 0.75;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  if (!locations.length) return null;

  return (
    <div className={styles.locationCarousel}>
      {canPrev ? (
        <button
          type="button"
          className={`${styles.locationNavBtn} ${styles.locationNavPrev}`}
          aria-label="Previous locations"
          onClick={() => scrollByCard(-1)}
        >
          ‹
        </button>
      ) : null}

      <div
        ref={trackRef}
        className={styles.locationGrid}
        role="list"
        aria-label="Browse locations"
      >
        {locations.map((loc) => (
          <a
            key={loc.name}
            href="#sale"
            className={styles.locationCard}
            data-location={loc.name}
            role="listitem"
          >
            <div className={styles.locationMedia}>
              {loc.image_url ? (
                <Image
                  src={loc.image_url}
                  alt={loc.name}
                  fill
                  sizes="(max-width: 768px) 75vw, 280px"
                  className={styles.locationImage}
                />
              ) : (
                <div className={styles.locationFallback} />
              )}
              <div className={styles.locationOverlay} />
            </div>
            <div className={styles.locationBody}>
              <span className={styles.locationTag}>Neighborhood</span>
              <h3>{loc.name}</h3>
              <p>
                {loc.listingCount}{" "}
                {Number(loc.listingCount) === 1 ? "listing" : "listings"}
              </p>
            </div>
          </a>
        ))}
      </div>

      {canNext ? (
        <button
          type="button"
          className={`${styles.locationNavBtn} ${styles.locationNavNext}`}
          aria-label="Next locations"
          onClick={() => scrollByCard(1)}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
