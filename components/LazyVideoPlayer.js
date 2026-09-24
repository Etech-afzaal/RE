"use client";

import { useState } from "react";
import { youtubeEmbedUrl } from "@/lib/youtube";

export default function LazyVideoPlayer({ videoUrl, youtubeVideoId, thumbnailUrl, title }) {
  const [isActivated, setIsActivated] = useState(false);

  if (isActivated) {
    return (
      <div
        className="lazyPlayer"
        style={{ width: "100%", height: "100%", background: "#000" }}
      >
        {youtubeVideoId ? (
          <iframe
            title={title || "YouTube video"}
            src={youtubeEmbedUrl(youtubeVideoId)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ display: "block", width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <video
            controls
            autoPlay
            preload="metadata"
            poster={thumbnailUrl || undefined}
            aria-label={title || "Video"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        )}
      </div>
    );
  }

  return (
    <div
      className="lazyPlayer"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#000",
        cursor: "pointer",
      }}
      onClick={() => setIsActivated(true)}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title || "Video"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.85,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
          }}
        />
      )}
      <button
        type="button"
        aria-label="Play video"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          width: "100%",
          height: "100%",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            transition: "transform 0.2s ease, background 0.2s ease",
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M8 5v14l11-7L8 5Z" fill="white" />
          </svg>
        </span>
      </button>
    </div>
  );
}
