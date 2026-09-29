"use client";

import { useState } from "react";
import styles from "@/components/HomeListings.module.css";

/**
 * Generic paginated grid for the agent public site. Mirrors the pagination
 * pattern used by HomeListings.PropertySection — windowed page numbers (max
 * 5 visible), prev/next buttons, pill-style active button — so blogs and
 * video posts paginate identically to property listings.
 *
 * Pass the full list of rendered cards as children (server-component safe —
 * React elements are serializable across the RSC boundary, unlike functions).
 *
 * @param {object} props
 * @param {number} props.pageSize — items per page
 * @param {string} props.gridClassName — CSS module class for the grid container
 * @param {import("react").ReactNode} props.children — all items to paginate over
 * @param {string} [props.ariaLabel] — nav aria-label
 */
export default function PaginatedGrid({
  pageSize,
  gridClassName,
  ariaLabel = "Pagination",
  children,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const allItems = Array.isArray(children) ? children : children ? [children] : [];
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = allItems.slice(startIndex, startIndex + pageSize);

  const paginationRange = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    let start = Math.max(1, safePage - 2);
    let end = start + 4;
    if (end > totalPages) {
      end = totalPages;
      start = totalPages - 4;
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };

  return (
    <>
      <div className={gridClassName}>{pageItems}</div>

      {totalPages > 1 ? (
        <div className={styles.pagination} aria-label={ariaLabel}>
          {safePage > 1 ? (
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage(safePage - 1)}
              aria-label="Previous page"
            >
              {"<"}
            </button>
          ) : null}

          {paginationRange().map((page) => (
            <button
              key={page}
              type="button"
              className={`${styles.pageButton} ${
                page === safePage ? styles.pageButtonActive : ""
              }`}
              onClick={() => setCurrentPage(page)}
              aria-current={page === safePage ? "page" : undefined}
            >
              {page}
            </button>
          ))}

          {safePage < totalPages ? (
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage(safePage + 1)}
              aria-label="Next page"
            >
              {">"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
