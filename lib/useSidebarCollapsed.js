"use client";

import { useCallback, useEffect, useState } from "react";

const TABLET_MAX = 1024;
const MOBILE_MAX = 960;

/**
 * Persistent collapsible sidebar preference.
 * - Restores from localStorage
 * - Defaults to collapsed on tablet widths when no preference is saved
 * - Mobile drawer mode is handled separately by the shell CSS
 */
export function useSidebarCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const syncMobile = () => setIsMobile(mobileMq.matches);
    syncMobile();
    mobileMq.addEventListener("change", syncMobile);

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "true" || stored === "false") {
        setCollapsed(stored === "true");
      } else if (window.innerWidth <= TABLET_MAX) {
        setCollapsed(true);
      }
    } catch {
      if (window.innerWidth <= TABLET_MAX) setCollapsed(true);
    }

    return () => mobileMq.removeEventListener("change", syncMobile);
  }, [storageKey]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, [storageKey]);

  return {
    collapsed: collapsed && !isMobile,
    toggleCollapsed,
    isMobile,
  };
}
