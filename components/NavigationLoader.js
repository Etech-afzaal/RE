"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

function isModifiedClick(event) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function shouldHandleAnchor(anchor) {
  if (!anchor) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  return true;
}

/**
 * Shows the branded full-page loader during client-side route transitions.
 * Listens for internal link clicks; hides as soon as the URL settles.
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const hideTimerRef = useRef(null);
  const routeKey = `${pathname}?${searchParams?.toString() || ""}`;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideImmediately = useCallback(() => {
    clearHideTimer();
    setExiting(true);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      hideTimerRef.current = null;
    }, 120);
  }, [clearHideTimer]);

  const show = useCallback(() => {
    clearHideTimer();
    setExiting(false);
    setVisible(true);
  }, [clearHideTimer]);

  useEffect(() => {
    hideImmediately();
  }, [routeKey, hideImmediately]);

  useEffect(() => {
    function onPointerDown(event) {
      if (isModifiedClick(event)) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!shouldHandleAnchor(anchor)) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      // Same-path query updates (e.g. listing type/subtype filters) are not
      // full route transitions — do not show the navigation loader.
      if (url.pathname === window.location.pathname) {
        return;
      }

      show();
    }

    document.addEventListener("click", onPointerDown, true);
    return () => {
      document.removeEventListener("click", onPointerDown, true);
      clearHideTimer();
    };
  }, [show, clearHideTimer]);

  if (!visible) return null;

  return (
    <LoadingSpinner
      fullPage
      exiting={exiting}
      label="Loading"
      hint="Finding your next space…"
    />
  );
}
