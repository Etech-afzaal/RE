"use client";

import styles from "./Pagination.module.css";

function pageRange(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(1, currentPage - 2);
  let end = start + 4;
  if (end > totalPages) {
    end = totalPages;
    start = totalPages - 4;
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Properties pagination">
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        &lt;
      </button>
      {pageRange(currentPage, totalPages).map((page) => (
        <button
          key={page}
          type="button"
          className={`${styles.pageButton} ${page === currentPage ? styles.pageButtonActive : ""}`}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        &gt;
      </button>
    </nav>
  );
}
