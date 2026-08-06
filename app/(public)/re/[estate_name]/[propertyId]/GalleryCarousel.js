"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import Pagination from "@/components/Pagination";
import styles from "./GalleryCarousel.module.css";

const PAGE_SIZE = 12;

/**
 * "Explore every space" gallery — paginated grid of the listing's own photos.
 * Prefers category labels so each card reads as a room or area.
 * Clicking a card opens the shared image preview modal with the full list.
 */
export default function GalleryCarousel({ slides = [], title }) {
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const totalPages = Math.max(1, Math.ceil(slides.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageSlides = slides.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (!slides.length) {
    return null;
  }

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <div>
          <p className={styles.galleryTitle}>Property spaces</p>
          <h2 className={styles.galleryIntro}>Explore Every Space</h2>
        </div>
        <p className={styles.galleryCount}>
          {slides.length} {slides.length === 1 ? "Space" : "Spaces"}
        </p>
      </div>

      <div className={styles.galleryGrid}>
        {pageSlides.map((slide, index) => {
          const absoluteIndex = startIndex + index;
          const categoryTitle =
            (slide.categoryLabel || "").trim() || "Property Image";
          const rawLabel = (slide.label || "").trim();
          const rawCopy = (slide.copy || "").trim();
          const description =
            rawCopy ||
            (rawLabel &&
            rawLabel !== categoryTitle &&
            !(!slide.categoryLabel && rawLabel === title)
              ? rawLabel
              : null);

          return (
            <button
              key={slide.id || absoluteIndex}
              type="button"
              className={styles.galleryCard}
              aria-label={`Open preview: ${categoryTitle}`}
              onClick={() => {
                setPreviewIndex(absoluteIndex);
                setPreviewOpen(true);
              }}
            >
              <Image
                src={slide.image}
                alt={categoryTitle || title}
                fill
                sizes="(max-width: 700px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={styles.galleryImage}
              />
              <div className={styles.galleryOverlay} />
              <div className={styles.galleryCaption}>
                <p className={styles.captionLabel}>
                  {absoluteIndex + 1} / {slides.length}
                </p>
                <p className={styles.captionTitle}>{categoryTitle}</p>
                {description ? (
                  <p className={styles.captionCopy}>{description}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        showNav={false}
        ariaLabel="Property spaces pagination"
      />

      <ImagePreviewModal
        images={slides}
        currentIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}
