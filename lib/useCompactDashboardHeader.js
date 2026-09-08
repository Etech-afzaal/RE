"use client";

import { useEffect, useRef, useState } from "react";

export function useCompactDashboardHeader() {
  const headerRef = useRef(null);
  const expandedHeight = useRef(0);
  const [compact, setCompact] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setCompact((current) => media.matches && window.scrollY > (current ? 4 : 64));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => {
      const height = header.getBoundingClientRect().height;
      if (!compact) expandedHeight.current = height;
      setSpacerHeight(compact ? Math.max(0, expandedHeight.current - height) : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [compact]);

  return { headerRef, compact, spacerHeight };
}
