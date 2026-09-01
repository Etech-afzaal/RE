"use client";

import { useEffect, useState } from "react";
import styles from "./BackToTop.module.css";

const END_THRESHOLD_PX = 120;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
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
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.lift}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <svg
          width="27"
          height="30"
          viewBox="0 0 24 26"
          fill="none"
          aria-hidden="true"
>
      {/* Taller top arrow */}
        <path
          d="M12 9V2m-3 3L12 2l3 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

      {/* Slightly taller lift */}
        <rect
          x="4"
          y="9"
          width="16"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />

      {/* Lift doors */}
       <path
          d="M4.5 12.5h15M12 12.5v11"
          stroke="currentColor"
          strokeWidth="1.8"
         strokeLinecap="round"
       />
      </svg>
    </button>
  );
}
