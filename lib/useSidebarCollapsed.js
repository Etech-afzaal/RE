"use client";

import { useCallback, useEffect, useState } from "react";

const MOBILE_MAX = 960;

function readStoredCollapsed(storageKey) {
  if (typeof window === "undefined") return true;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // ignore quota / private mode
  }

  return true;
}

/**
 * Collapsible sidebar preference.
 * - Starts collapsed on first view (login / no saved preference)
 * - Persists expanded/collapsed across dashboard page navigations
 * - Mobile drawer mode is handled separately by the shell CSS
 */
export function useSidebarCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(() =>
    readStoredCollapsed(storageKey),
  );
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const syncMobile = () => setIsMobile(mobileMq.matches);
    syncMobile();
    mobileMq.addEventListener("change", syncMobile);

    return () => mobileMq.removeEventListener("change", syncMobile);
  }, []);

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
