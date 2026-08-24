"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function AgentPhoneReveal({ phoneEntries = [] }) {
  const [revealed, setRevealed] = useState(false);

  if (phoneEntries.length === 0) return null;

  return (
    <div
      className={`${styles.agentDetail} ${
        !revealed ? styles.agentDetailRevealPending : ""
      }`}
    >
      <span>Phone</span>
      {!revealed ? (
        <button
          type="button"
          className={styles.phoneRevealTrigger}
          onClick={() => setRevealed(true)}
          aria-label="Click to show phone number"
        >
          <span className={styles.phoneRevealTriggerIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6.6 3.5h2.2l1.1 2.6-1.6 1.1a11.2 11.2 0 0 0 5.5 5.5l1.1-1.6 2.6 1.1v2.2c0 .8-.7 1.5-1.5 1.5C10.2 16.9 7.1 13.8 5.1 9.9 4.5 8.7 4.1 7.4 4.1 6c0-.8.7-1.5 1.5-1.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.phoneRevealTriggerText}>Click to show Phone</span>
        </button>
      ) : (
        <div className={styles.phoneRevealContent}>
          {phoneEntries.map((entry, index) => (
            <a
              key={entry.number}
              href={entry.href}
              className={styles.phoneRevealLink}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <strong>{entry.number}</strong>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
