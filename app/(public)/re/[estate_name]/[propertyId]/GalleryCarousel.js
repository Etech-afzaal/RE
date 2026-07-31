"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./GalleryCarousel.module.css";

/**
 * "Explore every space" rail — swipeable cards from the listing's own photos.
 * Prefers category / title labels so each card reads as a room or area.
 */
export default function GalleryCarousel({ slides = [], title }) {
  const carouselRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);

  const measureStep = () => {
    const container = carouselRef.current;
    if (!container) return 0;
    const card = container.querySelector("[data-card]");
    if (!card) return 0;

    const computedGap = parseInt(
      getComputedStyle(container).columnGap ||
        getComputedStyle(container).gap ||
        "18",
      10,
    );
    const gap = Number.isFinite(computedGap) ? computedGap : 18;
    return card.offsetWidth + gap;
  };

  const updateCardWidth = () => {
    const step = measureStep();
    if (step > 0) setCardWidth(step);
  };

  const scrollToIndex = (index) => {
    const container = carouselRef.current;
    if (!container) return;
    const step = measureStep() || cardWidth;
    if (!step) return;
    container.scrollTo({ left: step * index, behavior: "smooth" });
  };

  useEffect(() => {
    updateCardWidth();
    window.addEventListener("resize", updateCardWidth);
    return () => window.removeEventListener("resize", updateCardWidth);
  }, [slides.length]);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container || cardWidth === 0) return undefined;

    const onScroll = () => {
      const next = Math.round(container.scrollLeft / cardWidth);
      setCurrentIndex((prev) => (prev === next ? prev : next));
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [cardWidth]);

  const handleArrow = (direction) => {
    setCurrentIndex((current) => {
      let next;
      if (direction === "prev") {
        next = current === 0 ? Math.max(slides.length - 1, 0) : current - 1;
      } else {
        next = current >= slides.length - 1 ? 0 : current + 1;
      }
      requestAnimationFrame(() => scrollToIndex(next));
      return next;
    });
  };

  if (!slides.length) {
    return null;
  }

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <div>
          <p className={styles.galleryTitle}>Explore every space</p>
          <h2 className={styles.galleryIntro}>Swipe through the property</h2>
        </div>
        <p className={styles.galleryCount}>
          {slides.length} {slides.length === 1 ? "space" : "spaces"}
        </p>
      </div>

      <div className={styles.galleryOuter}>
        <div ref={carouselRef} className={styles.carouselScroll}>
          {slides.map((slide, index) => (
            <div
              key={slide.id || index}
              data-card
              className={styles.carouselCard}
            >
              <Image
                src={slide.image}
                alt={slide.label || title}
                fill
                sizes="(max-width: 768px) 85vw, 420px"
                className={styles.carouselImage}
              />
              <div className={styles.carouselOverlay} />
              <div className={styles.carouselCaption}>
                <p className={styles.captionLabel}>
                  {index + 1} / {slides.length}
                </p>
                <p className={styles.captionTitle}>{slide.label || title}</p>
                {slide.copy ? (
                  <p className={styles.captionCopy}>{slide.copy}</p>
                ) : slide.categoryLabel &&
                  slide.label !== slide.categoryLabel ? (
                  <p className={styles.captionCopy}>{slide.categoryLabel}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous space"
              onClick={() => handleArrow("prev")}
              className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next space"
              onClick={() => handleArrow("next")}
              className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className={styles.carouselDots}>
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to space ${index + 1}`}
              onClick={() => {
                setCurrentIndex(index);
                requestAnimationFrame(() => scrollToIndex(index));
              }}
              className={`${styles.carouselDot} ${
                index === currentIndex ? styles.carouselDotActive : ""
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
