"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./HeroSlider.module.css";

const INTERVAL_MS = 5000;
const FALLBACK_SLIDES = [
  {
    id: "fallback-1",
    title: "Real Estate Solutions",
    description:
      "It's important to note that real estate laws and regulations vary by jurisdiction.",
    image_url: "/hero/1.jpg",
    href: "#sale",
  },
  {
    id: "fallback-2",
    title: "Real Estate Solutions",
    description:
      "It's important to note that real estate laws and regulations vary by jurisdiction.",
    image_url: "/hero/2.jpg",
    href: "#sale",
  },
  {
    id: "fallback-3",
    title: "Real Estate Solutions",
    description:
      "It's important to note that real estate laws and regulations vary by jurisdiction.",
    image_url: "/hero/3.jpg",
    href: "#sale",
  },
];

export default function HeroSlider({ slides = [] }) {
  const items =
    slides.filter((slide) => slide.image_url).length > 0
      ? slides.filter((slide) => slide.image_url)
      : FALLBACK_SLIDES;

  const [active, setActive] = useState(0);
  const current = items[active] || items[0];

  const goTo = useCallback((index) => {
    setActive(index);
  }, []);

  const showPrevious = useCallback(() => {
    setActive((previous) => (previous - 1 + items.length) % items.length);
  }, [items.length]);

  const showNext = useCallback(() => {
    setActive((previous) => (previous + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, items.length]);

  if (!current) return null;

  return (
    <section id="hero" className={styles.heroWrap} aria-label="Featured properties">
      <div className={styles.hero}>
        <div className={styles.slides} aria-hidden="true">
          {items.map((slide, index) => (
            <div
              key={slide.id}
              className={`${styles.slide} ${
                index === active ? styles.slideActive : ""
              }`}
            >
              <Image
                src={slide.image_url}
                alt={slide.image_title || slide.title || "Property"}
                fill
                priority={index === 0}
                quality={90}
                sizes="(max-width: 1240px) 100vw, 1240px"
                className={styles.slideImage}
              />
            </div>
          ))}
          <div className={styles.overlay} />
        </div>

        <div className={styles.content} key={current.id}>
          <h1 className={styles.title}>{current.title}</h1>
          {current.description ? (
            <p className={styles.subtitle}>{current.description}</p>
          ) : null}

          <div className={styles.actions}>
            <Link href={current.href || "#sale"} className={styles.cta}>
              <svg
                className={styles.ctaIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              View Details
            </Link>
{/* 
            <div className={styles.trust}>
              <span className={styles.trustBrand}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#00B67A"
                    d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.8 5.7 21l2.3-7.2-6-4.4h7.6L12 2z"
                  />
                </svg>
                Trustpilot
              </span>
              <div className={styles.trustText}>
                <span className={styles.trustLabel}>
                  Trust Rating 5.0 | 2348 Reviews
                </span>
                <span className={styles.trustStars} aria-label="5 out of 5 stars">
                  ★★★★★
                </span>
              </div>
            </div> */}
          </div>
        </div>

        {items.length > 1 ? (
          <div className={styles.navigation}>
            <button
              type="button"
              className={`${styles.navigationButton} ${styles.previousButton}`}
              aria-label="Previous Slide"
              onClick={showPrevious}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className={`${styles.navigationButton} ${styles.nextButton}`}
              aria-label="Next Slide"
              onClick={showNext}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        ) : null}

        {items.length > 1 ? (
          <div className={styles.dots} role="tablist" aria-label="Hero slides">
            {items.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Show slide ${index + 1}`}
                className={`${styles.dot} ${
                  index === active ? styles.dotActive : ""
                }`}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
