"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { imageCategoryLabel } from "@/lib/imageCategories";
import styles from "./ImagePreviewModal.module.css";

/**
 * Normalize mixed property-image shapes into a consistent preview list.
 * Accepts image_url / image / url / src and category / category_label / label.
 */
export function normalizePreviewImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((img, index) => {
      if (!img) return null;
      if (typeof img === "string") {
        return {
          id: `img-${index}`,
          src: img,
          alt: "",
          category: null,
          featured: false,
        };
      }
      const src = img.src || img.image_url || img.image || img.url || "";
      if (!src) return null;

      const category =
        img.category_label ||
        img.categoryLabel ||
        (img.category ? imageCategoryLabel(img.category) : null) ||
        null;

      return {
        id: img.id ?? `img-${index}`,
        src,
        alt: img.alt || img.label || category || "",
        category,
        featured: Boolean(img.is_featured || img.featured),
      };
    })
    .filter(Boolean);
}

/**
 * Full-screen property image lightbox.
 * Shared across customer, agent, and admin surfaces.
 */
export default function ImagePreviewModal({
  images = [],
  currentIndex = 0,
  isOpen = false,
  onClose,
}) {
  const items = normalizePreviewImages(images);
  const [index, setIndex] = useState(currentIndex);
  const [loaded, setLoaded] = useState(false);
  const touchRef = useRef({ x: 0, y: 0, active: false });

  const count = items.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const current = items[safeIndex] || null;

  useEffect(() => {
    if (isOpen) setIndex(currentIndex);
  }, [isOpen, currentIndex]);

  useEffect(() => {
    setLoaded(false);
  }, [safeIndex, current?.src]);

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

  function onTouchStart(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  }

  function onTouchEnd(event) {
    if (!touchRef.current.active || count <= 1) return;
    const touch = event.changedTouches?.[0];
    touchRef.current.active = false;
    if (!touch) return;
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  if (!isOpen || count === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
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
            aria-label="Previous image"
            onClick={goPrev}
          >
            ‹
          </button>
        ) : null}

        <div
          className={styles.frame}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={styles.meta}>
            {current.featured ? (
              <span className={styles.featured}>★ Featured</span>
            ) : null}
            {current.category ? (
              <span className={styles.category}>{current.category}</span>
            ) : null}
          </div>

          {!loaded ? (
            <p className={styles.loading} aria-live="polite">
              Loading…
            </p>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.src}
            src={current.src}
            alt={current.alt || current.category || "Property image"}
            className={`${styles.image} ${loaded ? styles.imageVisible : ""}`}
            onLoad={() => setLoaded(true)}
            draggable={false}
          />

          <p className={styles.counter} aria-live="polite">
            {safeIndex + 1} / {count}
          </p>
        </div>

        {count > 1 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            aria-label="Next image"
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

/**
 * Convenience hook for open/index state around ImagePreviewModal.
 */
export function useImagePreview(images = []) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = normalizePreviewImages(images);

  const openAt = useCallback((index = 0) => {
    setCurrentIndex(Math.max(0, index));
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return {
    items,
    isOpen,
    currentIndex,
    openAt,
    close,
    modalProps: {
      images: items,
      currentIndex,
      isOpen,
      onClose: close,
    },
  };
}
