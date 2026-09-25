"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./adsList.module.css";

// Prev / page numbers / next — shown even for a single page, as in the design.
export default function AdsPager({ page, totalPages, onChange, label = "Pages" }) {
  return (
    <nav className={styles.pager} aria-label={label}>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
        <button
          key={number}
          type="button"
          className={`${styles.pageButton} ${number === page ? styles.pageButtonActive : ""}`}
          onClick={() => onChange(number)}
          aria-current={number === page ? "page" : undefined}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
