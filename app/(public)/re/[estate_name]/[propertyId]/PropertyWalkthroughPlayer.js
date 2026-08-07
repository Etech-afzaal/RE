"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

/**
 * Property walkthrough player — keeps the existing video UI and adds
 * Netflix-style multi-video controls (NEXT + counter) when needed.
 *
 * Playback starts only when the player enters the viewport, and pauses
 * when the user scrolls away.
 */
export default function PropertyWalkthroughPlayer({
  videos = [],
  poster,
}) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const videoRef = useRef(null);

  const count = videos.length;
  const safeIndex = count > 0 ? activeVideoIndex % count : 0;
  const activeVideo = videos[safeIndex] || null;
  const hasMultiple = count > 1;

  const label =
    activeVideo?.category_label &&
    activeVideo.category_label !== "Uncategorized"
      ? activeVideo.category_label
      : null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const playPromise = el.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
              // Autoplay may be blocked; user can press play manually.
            });
          }
        } else {
          el.pause();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
    };
  }, [safeIndex, activeVideo]);

  if (!activeVideo?.video_url) return null;

  function handleNext() {
    if (!hasMultiple) return;
    setActiveVideoIndex((prev) => (prev + 1) % count);
  }

  return (
    <>
      <video
        key={activeVideo.id ?? activeVideo.video_url}
        ref={videoRef}
        className={styles.videoPlayer}
        controls
        preload="metadata"
        src={activeVideo.video_url}
        poster={poster}
      >
        Your browser does not support this video format.
      </video>

      {hasMultiple ? (
        <div className={styles.videoCounter} aria-live="polite">
          {safeIndex + 1} / {count}
        </div>
      ) : null}

      {label ? (
        <div className={styles.videoCategoryLabel}>{label}</div>
      ) : null}

      {hasMultiple ? (
        <button
          type="button"
          className={styles.videoNextBtn}
          onClick={handleNext}
          aria-label="Play next walkthrough video"
        >
          NEXT
        </button>
      ) : null}
    </>
  );
}
