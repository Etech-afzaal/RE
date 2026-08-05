"use client";

import { useState } from "react";
import styles from "./ExpandableText.module.css";

const DEFAULT_LIMIT = 280;

/**
 * Collapses long property copy behind Read more / Show less.
 * Short text renders fully with no toggle.
 */
export default function ExpandableText({ text, limit = DEFAULT_LIMIT }) {
  const [expanded, setExpanded] = useState(false);
  const content = String(text || "").trim();
  if (!content) return null;

  const needsToggle = content.length > limit;
  const visible =
    !needsToggle || expanded
      ? content
      : `${content.slice(0, limit).replace(/\s+\S*$/, "")}…`;

  return (
    <div className={styles.wrap}>
      <p className={styles.text}>{visible}</p>
      {needsToggle ? (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
