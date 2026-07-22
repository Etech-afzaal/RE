"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./GalleryCarousel.module.css";

export default function GalleryCarousel({ slides = [], title }) {
  const carouselRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);

  const updateCardWidth = () => {
    const container = carouselRef.current;
    if (!container) return;
    const card = container.querySelector("[data-card]");
    if (!card) return;

    const computedGap = parseInt(
      getComputedStyle(container).columnGap || "18",
      10,
    );
    setCardWidth(card.offsetWidth + computedGap);
  };

  const scrollToIndex = (index) => {
    const container = carouselRef.current;
    if (!container || cardWidth === 0) return;
    container.scrollTo({ left: cardWidth * index, behavior: "smooth" });
  };

  useEffect(() => {
    updateCardWidth();
    window.addEventListener("resize", updateCardWidth);
    return () => window.removeEventListener("resize", updateCardWidth);
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const interval = setInterval(() => {
      setCurrentIndex((current) =>
        current >= slides.length - 1 ? 0 : current + 1,
      );
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0 || cardWidth === 0) return;
    scrollToIndex(currentIndex);
  }, [currentIndex, slides.length, cardWidth]);

  const handleArrow = (direction) => {
    setCurrentIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? Math.max(slides.length - 1, 0) : current - 1;
      }
      return current >= slides.length - 1 ? 0 : current + 1;
    });
  };

  if (!slides.length) {
    return (
      <section className={styles.gallerySection}>
        <p className={styles.galleryTitle}>Explore the spaces</p>
        <h2 className={styles.galleryIntro}>Photos coming soon</h2>
        <div className={styles.emptyGallery}>No images uploaded yet.</div>
      </section>
    );
  }

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <div>
          <p className={styles.galleryTitle}>Explore the spaces</p>
          <h2 className={styles.galleryIntro}>
            Swipe through every space
          </h2>
        </div>
        <p className={styles.galleryCount}>
          {slides.length} {slides.length === 1 ? "space" : "spaces"}
        </p>
      </div>

      <div className={styles.galleryOuter}>
        <div ref={carouselRef} className={styles.carouselScroll}>
          {slides.map((slide, index) => (
            <div key={slide.id || index} data-card className={styles.carouselCard}>
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
              onClick={() => setCurrentIndex(index)}
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
