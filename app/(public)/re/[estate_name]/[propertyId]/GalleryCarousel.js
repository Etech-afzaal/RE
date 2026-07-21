"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./GalleryCarousel.module.css";

export default function GalleryCarousel({ images, title, featuredImage }) {
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
    if (images.length === 0) return;
    const initialIndex = images.findIndex(
      (img) => img.id === featuredImage?.id,
    );
    setCurrentIndex(initialIndex >= 0 ? initialIndex : 0);
  }, [featuredImage?.id, images]);

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const interval = setInterval(() => {
      setCurrentIndex((current) =>
        current >= images.length - 1 ? 0 : current + 1,
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    if (images.length === 0 || cardWidth === 0) return;
    scrollToIndex(currentIndex);
  }, [currentIndex, images.length, cardWidth]);

  const handleArrow = (direction) => {
    setCurrentIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? Math.max(images.length - 1, 0) : current - 1;
      }
      return current >= images.length - 1 ? 0 : current + 1;
    });
  };

  if (!images?.length) {
    return (
      <section className={styles.gallerySection}>
        <p className={styles.galleryTitle}>Property gallery</p>
        <h2 className={styles.galleryIntro}>Photos coming soon</h2>
        <div className={styles.emptyGallery}>No images uploaded yet.</div>
      </section>
    );
  }

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <div>
          <p className={styles.galleryTitle}>Property gallery</p>
          <h2 className={styles.galleryIntro}>Explore every space</h2>
        </div>
        <p className={styles.galleryCount}>
          {images.length} {images.length === 1 ? "photo" : "photos"}
        </p>
      </div>

      <div className={styles.galleryOuter}>
        <div ref={carouselRef} className={styles.carouselScroll}>
          {images.map((img, index) => (
            <div
              key={img.id || index}
              data-card
              className={styles.carouselCard}
            >
              <Image
                src={img.image_url}
                alt={img.image_title || title}
                fill
                sizes="(max-width: 768px) 85vw, 420px"
                className={styles.carouselImage}
              />
              <div className={styles.carouselOverlay} />
              <div className={styles.carouselCaption}>
                <p className={styles.captionLabel}>
                  {index + 1} / {images.length}
                </p>
                <p className={styles.captionTitle}>
                  {img.image_title || title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => handleArrow("prev")}
              className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => handleArrow("next")}
              className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className={styles.carouselDots}>
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to photo ${index + 1}`}
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
