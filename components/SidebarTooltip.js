"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./SidebarTooltip.module.css";

const GAP = 12;
const ESTIMATED_HEIGHT = 36;
const VIEWPORT_PAD = 8;

/**
 * Fixed-position branded tooltip for collapsed desktop sidebars.
 * Avoids browser title tooltips and escapes sidebar overflow clipping.
 */
export function useSidebarTooltip(enabled) {
  const [tip, setTip] = useState(null);

  const hide = useCallback(() => setTip(null), []);

  const show = useCallback(
    (label, el) => {
      if (!enabled || !label || !el) return;
      const rect = el.getBoundingClientRect();
      const half = ESTIMATED_HEIGHT / 2;
      let top = rect.top + rect.height / 2;
      top = Math.min(
        Math.max(top, half + VIEWPORT_PAD),
        window.innerHeight - half - VIEWPORT_PAD,
      );
      setTip({
        label,
        top,
        left: rect.right + GAP,
      });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) setTip(null);
  }, [enabled]);

  useEffect(() => {
    if (!tip) return undefined;
    const onScroll = () => setTip(null);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [tip]);

  const tipHandlers = useCallback(
    (label) => {
      if (!enabled || !label) return {};
      return {
        onMouseEnter: (event) => show(label, event.currentTarget),
        onMouseLeave: hide,
        onFocus: (event) => show(label, event.currentTarget),
        onBlur: hide,
      };
    },
    [enabled, show, hide],
  );

  return { tip, tipHandlers, hideTooltip: hide };
}

export function SidebarTooltip({ tip }) {
  if (!tip) return null;

  return (
    <div
      className={styles.tooltip}
      style={{ top: tip.top, left: tip.left }}
      role="tooltip"
    >
      {tip.label}
      <span className={styles.arrow} aria-hidden="true" />
    </div>
  );
}
