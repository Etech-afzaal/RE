"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OverviewTableScroll.module.css";

export default function OverviewTableScroll({ children }) {
  const scrollRef = useRef(null);
  const [indicator, setIndicator] = useState({ width: 100, left: 0 });

  useEffect(() => {
    const element = scrollRef.current;
    const update = () => {
      const total = element.scrollWidth || 1;
      setIndicator({
        width: Math.min(100, (element.clientWidth / total) * 100),
        left: (element.scrollLeft / total) * 100,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <>
      <div ref={scrollRef} className={styles.scroll}>{children}</div>
      {indicator.width < 100 ? (
        <div className={styles.track} aria-hidden="true">
          <span className={styles.thumb} style={{ width: `${indicator.width}%`, left: `${indicator.left}%` }} />
        </div>
      ) : null}
    </>
  );
}
