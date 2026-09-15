"use client";

import { useEffect, useState } from "react";
import styles from "./BackToTop.module.css";

const END_THRESHOLD_PX = 120;

export default function BackToTop({ revealAtId, revealAtEnd = false }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const revealSection = revealAtId && document.getElementById(revealAtId);
      if (revealSection) {
        const bounds = revealSection.getBoundingClientRect();
        setVisible((revealAtEnd ? bounds.bottom : bounds.top) <= window.innerHeight);
        return;
      }
      const scrollBottom = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      setVisible(scrollBottom >= pageHeight - END_THRESHOLD_PX);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [revealAtId, revealAtEnd]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.lift}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <img
        src="/go-top-icon.png"
        width={27}
        height={30}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
}
