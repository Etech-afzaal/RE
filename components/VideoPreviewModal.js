"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropertyWatermark from "@/components/PropertyWatermark";
import { imageCategoryLabel } from "@/lib/imageCategories";
import galleryStyles from "@/components/PropertyVideoGallery/PropertyVideoGallery.module.css";
import styles from "./VideoPreviewModal.module.css";

/**
 * Normalize mixed property-video shapes into a consistent preview list.
 * Accepts video_url / url / src and category / category_label / title.
 */
export function normalizePreviewVideos(videos = []) {
  return (Array.isArray(videos) ? videos : [])
    .map((video, index) => {
      if (!video) return null;
      if (typeof video === "string") {
        return {
          id: `video-${index}`,
          src: video,
          title: `Video ${index + 1}`,
          category: null,
          featured: false,
        };
      }
      const src = video.src || video.video_url || video.url || "";
      if (!src) return null;

      const category =
        video.category_label ||
        video.categoryLabel ||
        (video.category ? imageCategoryLabel(video.category) : null) ||
        null;

      const title =
        (video.title && String(video.title).trim()) ||
        (category && category !== "Uncategorized" ? category : null) ||
        `Video ${index + 1}`;

      return {
        id: video.id ?? `video-${index}`,
        src,
        poster: video.thumbnail || video.thumbnail_url || video.poster || null,
        title,
        category,
        featured: Boolean(
          video.is_featured || video.featured || video.isFeatured,
        ),
      };
    })
    .filter(Boolean);
}

/**
 * Full-screen property video lightbox.
 * Reuses the public PropertyVideoGallery player chrome.
 */
export default function VideoPreviewModal({
  videos = [],
  currentIndex = 0,
  isOpen = false,
  onClose,
  watermarkText = "",
}) {
  const items = normalizePreviewVideos(videos);
  const [index, setIndex] = useState(currentIndex);

  const count = items.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const current = items[safeIndex] || null;

  useEffect(() => {
    if (isOpen) setIndex(currentIndex);
  }, [isOpen, currentIndex]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setIndex((prev) => (prev + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen || count === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Video preview"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <button
        type="button"
        className={styles.closeBtn}
        aria-label="Close preview"
        onClick={onClose}
      >
        ×
      </button>

      <div className={styles.stage}>
        {count > 1 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            aria-label="Previous video"
            onClick={goPrev}
          >
            ‹
          </button>
        ) : null}

        <div className={styles.frameWrap}>
          <div className={styles.meta}>
            {current.featured ? (
              <span className={styles.featured}>★ Featured</span>
            ) : null}
            {current.category && current.category !== "Uncategorized" ? (
              <span className={styles.category}>{current.category}</span>
            ) : (
              <span className={styles.category}>{current.title}</span>
            )}
          </div>

          <div className={`${galleryStyles.frame} ${styles.playerFrame}`}>
            <video
              key={current.id ?? current.src}
              className={galleryStyles.player}
              controls
              autoPlay
              playsInline
              preload="metadata"
              src={current.src}
              poster={current.poster || undefined}
            >
              Your browser does not support this video format.
            </video>
            <PropertyWatermark text={watermarkText} />
          </div>

          <p className={styles.counter} aria-live="polite">
            {safeIndex + 1} / {count}
          </p>
        </div>

        {count > 1 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            aria-label="Next video"
            onClick={goNext}
          >
            ›
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
