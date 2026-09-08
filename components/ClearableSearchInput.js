"use client";

import { forwardRef, useRef } from "react";
import styles from "./ClearableSearchInput.module.css";

const ClearableSearchInput = forwardRef(function ClearableSearchInput(
  { value, onChange, className = "", ...props },
  forwardedRef,
) {
  const inputRef = useRef(null);

  function clearSearch() {
    const input = inputRef.current;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setValue.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  return (
    <span className={styles.wrapper}>
      <input
        {...props}
        className={`${className} ${styles.input}`}
        type="search"
        data-clearable-search="true"
        value={value}
        onChange={onChange}
        ref={(input) => {
          inputRef.current = input;
          if (typeof forwardedRef === "function") forwardedRef(input);
          else if (forwardedRef) forwardedRef.current = input;
        }}
      />
      {String(value ?? "").length > 0 && !props.disabled && !props.readOnly ? (
        <button
          type="button"
          className={styles.clearButton}
          aria-label="Clear search"
          onClick={clearSearch}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
});

export default ClearableSearchInput;
