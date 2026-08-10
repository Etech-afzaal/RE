"use client";

import { useEffect, useRef, useState } from "react";
import PropertyWatermark from "@/components/PropertyWatermark";
import styles from "./PropertyVideoGallery.module.css";

/**
 * Property video tour gallery (max 3).
 * 1 video → full-width player.
 * 2–3 videos → playlist + player (desktop) / player + horizontal strip (mobile).
 *
 * Expects items shaped like `{ id?, video_url, category_label?, title?, thumbnail? }`.
 * Falls back to `url` if `video_url` is absent.
 * `watermarkText` is the dynamic agent/company branding overlay.
 */
export default function PropertyVideoGallery({
  videos = [],
  poster,
  autoPlayOnView = true,
  compact = false,
  className = "",
  watermarkText = "",
}) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const videoRef = useRef(null);

  const list = Array.isArray(videos) ? videos : [];
  const count = list.length;
  const safeIndex = count > 0 ? activeVideoIndex % count : 0;
  const activeVideo = list[safeIndex] || null;
  const activeUrl = activeVideo?.video_url || activeVideo?.url || null;
  const hasMultiple = count > 1;

  useEffect(() => {
    if (!autoPlayOnView) return;
    const el = videoRef.current;
    if (!el || !activeUrl) return;

    function tryPlay() {
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay may be blocked; user can press play manually.
        });
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          el.pause();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
    };
  }, [safeIndex, activeUrl, autoPlayOnView]);

  if (!activeUrl) return null;

  function getVideoTitle(item, index) {
    if (item?.title && String(item.title).trim()) {
      return String(item.title).trim();
    }
    if (
      item?.category_label &&
      item.category_label !== "Uncategorized"
    ) {
      return item.category_label;
    }
    return `Video ${index + 1}`;
  }

  function selectVideo(index) {
    if (index === safeIndex) return;
    setActiveVideoIndex(index);
  }

  const rootClass = [
    styles.gallery,
    hasMultiple ? styles.gallerySplit : styles.gallerySolo,
    compact ? styles.galleryCompact : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const activeTitle = getVideoTitle(activeVideo, safeIndex);

  return (
    <div className={rootClass}>
      {hasMultiple ? (
        <aside className={styles.playlist} aria-label="Property video playlist">
          <p className={styles.playlistHeading}>Playlist</p>
          <ul className={styles.playlistList} role="list">
            {list.map((item, index) => {
              const url = item?.video_url || item?.url;
              if (!url) return null;
              const title = getVideoTitle(item, index);
              const isActive = index === safeIndex;
              const thumb = item?.thumbnail || poster || undefined;

              return (
                <li key={item.id ?? `${url}-${index}`} className={styles.playlistItem}>
                  <button
                    type="button"
                    className={[
                      styles.playlistBtn,
                      isActive ? styles.playlistBtnActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => selectVideo(index)}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`Play ${title}`}
                  >
                    <span className={styles.thumbWrap} aria-hidden="true">
                      {thumb ? (
                        // Prefer poster/property image when available; video frame otherwise.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className={styles.thumbImage}
                        />
                      ) : (
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className={styles.thumbVideo}
                        />
                      )}
                      <PropertyWatermark text={watermarkText} compact />
                      {!isActive ? (
                        <span className={styles.thumbPlay}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M8 5.5v13l11-6.5-11-6.5z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className={styles.thumbNow}>Now</span>
                      )}
                    </span>
                    <span className={styles.playlistMeta}>
                      <span className={styles.playlistTitle}>{title}</span>
                      <span className={styles.playlistIndex}>
                        {index + 1} of {count}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}

      <div className={styles.playerPane}>
        <div className={styles.frame}>
          <video
            key={activeVideo.id ?? activeUrl}
            ref={videoRef}
            className={styles.player}
            controls
            preload="metadata"
            src={activeUrl}
            poster={activeVideo?.thumbnail || poster}
          >
            Your browser does not support this video format.
          </video>

          <PropertyWatermark text={watermarkText} compact={compact} />

          {hasMultiple ? (
            <div className={styles.counter} aria-live="polite">
              {safeIndex + 1} / {count}
            </div>
          ) : null}

          {hasMultiple ||
          (activeVideo?.category_label &&
            activeVideo.category_label !== "Uncategorized") ? (
            <div className={styles.categoryLabel}>{activeTitle}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
