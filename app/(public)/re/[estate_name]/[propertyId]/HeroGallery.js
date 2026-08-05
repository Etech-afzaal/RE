"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import styles from "./HeroGallery.module.css";

/**
 * Premium property media viewer — main image, swipe/drag, thumbs, counter.
 * Uses the listing's own images only; no third-party carousel library.
 * Click / tap (without a drag) opens the shared image preview modal.
 */
export default function HeroGallery({ images = [], title = "Property" }) {
  const [index, setIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, deltaX: 0 });
  const thumbsRef = useRef(null);

  const count = images.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const current = images[safeIndex] || null;

  const goTo = useCallback(
    (next) => {
      if (count === 0) return;
      setIndex((((next % count) + count) % count));
    },
    [count],
  );

  const goPrev = useCallback(() => {
    setIndex((prev) => {
      if (count === 0) return 0;
      return (prev - 1 + count) % count;
    });
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((prev) => {
      if (count === 0) return 0;
      return (prev + 1) % count;
    });
  }, [count]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (previewOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, previewOpen]);

  useEffect(() => {
    const rail = thumbsRef.current;
    if (!rail) return;
    const thumb = rail.querySelector(`[data-thumb="${safeIndex}"]`);
    if (thumb) {
      thumb.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [safeIndex]);

  const onPointerDown = (e) => {
    if (count <= 1) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      deltaX: 0,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.deltaX = e.clientX - dragRef.current.startX;
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) {
      // Single-image (or no drag started): treat as preview click.
      if (count >= 1) setPreviewOpen(true);
      return;
    }
    const { deltaX } = dragRef.current;
    dragRef.current.active = false;
    if (Math.abs(deltaX) > 48) {
      if (deltaX < 0) goNext();
      else goPrev();
      return;
    }
    setPreviewOpen(true);
  };

  if (count === 0) {
    return (
      <section className={styles.hero} aria-label="Property photos">
        <div className={styles.stage}>
          <div className={styles.main}>
            <div className={styles.fallback} />
            <p className={styles.fallbackLabel}>Photos coming soon</p>
          </div>
        </div>
      </section>
    );
  }

  const label =
    current.image_title ||
    current.category_label ||
    current.label ||
    title;

  return (
    <section className={styles.hero} aria-label="Property photos">
      <div className={styles.stage}>
        <div
          className={styles.main}
          role="button"
          tabIndex={0}
          aria-label={`Open preview: ${label}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current.active = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setPreviewOpen(true);
            }
          }}
        >
          <Image
            key={current.id || current.image_url || safeIndex}
            src={current.image_url || current.image}
            alt={label}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 1100px"
            className={styles.mainImage}
            draggable={false}
          />

          <div className={styles.scrim} aria-hidden="true" />

          <span className={styles.counter} aria-live="polite">
            {safeIndex + 1} / {count}
          </span>

          {current.category_label || current.image_title ? (
            <span className={styles.spaceTag}>{label}</span>
          ) : null}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrev}`}
              aria-label="Previous photo"
              onClick={goPrev}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navNext}`}
              aria-label="Next photo"
              onClick={goNext}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className={styles.thumbs} ref={thumbsRef} role="tablist">
          {images.map((img, i) => {
            const thumbLabel =
              img.image_title || img.category_label || img.label || title;
            return (
              <button
                key={img.id || img.image_url || i}
                type="button"
                data-thumb={i}
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`Photo ${i + 1}: ${thumbLabel}`}
                className={`${styles.thumb} ${
                  i === safeIndex ? styles.thumbActive : ""
                }`}
                onClick={() => goTo(i)}
                onDoubleClick={() => {
                  setIndex(i);
                  setPreviewOpen(true);
                }}
              >
                <Image
                  src={img.image_url || img.image}
                  alt=""
                  fill
                  sizes="96px"
                  className={styles.thumbImage}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <ImagePreviewModal
        images={images}
        currentIndex={safeIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}
