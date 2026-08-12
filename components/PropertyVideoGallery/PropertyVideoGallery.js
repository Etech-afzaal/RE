"use client";

import { useEffect, useRef, useState } from "react";
import PropertyWatermark from "@/components/PropertyWatermark";
import styles from "./PropertyVideoGallery.module.css";

/**
 * Property video tour gallery (max 5).
 * 1 video → full-width player.
 * 2–5 videos → playlist + player (desktop) / player + horizontal strip (mobile).
 *
 * Expects items shaped like `{ id?, video_url, category_label?, title?, thumbnail?, thumbnail_url? }`.
 * Falls back to `url` if `video_url` is absent.
 * Videos are not requested until the user clicks play.
 * `watermarkText` is the dynamic agent/company branding overlay.
 */
export default function PropertyVideoGallery({
  videos = [],
  poster,
  autoPlayOnView = false,
  compact = false,
  className = "",
  watermarkText = "",
}) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const videoRef = useRef(null);

  // Keep prop for callers; loading never happens until play is clicked.
  void autoPlayOnView;

  const list = Array.isArray(videos) ? videos : [];
  const count = list.length;
  const safeIndex = count > 0 ? activeVideoIndex % count : 0;
  const activeVideo = list[safeIndex] || null;
  const activeUrl = activeVideo?.video_url || activeVideo?.url || null;
  const hasMultiple = count > 1;

  function getPosterFor(item) {
    return item?.thumbnail || item?.thumbnail_url || poster || undefined;
  }

  const activePoster = getPosterFor(activeVideo);

  useEffect(() => {
    if (!isActivated) return;
    const el = videoRef.current;
    if (!el) return;

    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Autoplay after click may still be blocked; native controls remain.
      });
    }
  }, [isActivated, safeIndex, activeUrl]);

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
    setActiveVideoIndex(index);
    setIsActivated(true);
  }

  function activatePlayer() {
    setIsActivated(true);
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
              const thumb = getPosterFor(item);

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
                        // Prefer generated video thumbnail / property poster image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className={styles.thumbImage}
                        />
                      ) : (
                        // Pre-migration videos have no thumbnail_url — frame from the file.
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className={styles.thumbImage}
                          tabIndex={-1}
                        />
                      )}
                      <PropertyWatermark text={watermarkText} compact />
                      {!isActive || !isActivated ? (
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
          {isActivated ? (
            <video
              key={activeVideo.id ?? activeUrl}
              ref={videoRef}
              className={styles.player}
              controls
              playsInline
              preload="auto"
              src={activeUrl}
              poster={activePoster}
            >
              Your browser does not support this video format.
            </video>
          ) : (
            <button
              type="button"
              className={styles.lazyPoster}
              onClick={activatePlayer}
              aria-label={`Play ${activeTitle}`}
            >
              {activePoster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePoster}
                  alt=""
                  className={styles.lazyPosterImg}
                />
              ) : (
                <video
                  src={activeUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className={styles.lazyPosterImg}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              )}
              <span className={styles.lazyPlay} aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 5.5v13l11-6.5-11-6.5z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
          )}

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
