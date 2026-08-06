"use client";

import { useEffect, useState } from "react";

const DEFAULT_MOBILE_MAX = 768;

/**
 * Tracks whether the viewport is at or below a mobile max-width.
 * Defaults to false (desktop) for SSR / first paint so desktop page sizes stay stable.
 */
export function useIsMobile(maxWidth = DEFAULT_MOBILE_MAX) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidth]);

  return isMobile;
}
