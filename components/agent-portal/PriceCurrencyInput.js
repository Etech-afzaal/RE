"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_PRICE_CURRENCY,
  PRICE_CURRENCY_VALUES,
  normalizePriceCurrency,
} from "@/lib/formatPrice";
import ui from "./portal.module.css";

const OPTIONS = [
  { value: "PKR", label: "PKR" },
  { value: "USD", label: "$ USD" },
];

/**
 * Combined numeric price input + compact currency dropdown (PKR | USD).
 * Matches portal input height and golden focus styling.
 */
export default function PriceCurrencyInput({
  amount,
  currency = DEFAULT_PRICE_CURRENCY,
  onAmountChange,
  onCurrencyChange,
  disabled = false,
  invalid = false,
  placeholder = "Enter price",
  inputMode = "numeric",
  pattern = "[0-9]*",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const selected = normalizePriceCurrency(currency);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectCurrency(next) {
    if (!PRICE_CURRENCY_VALUES.includes(next)) return;
    onCurrencyChange?.(next);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`${ui.priceField} ${invalid ? ui.priceFieldInvalid : ""} ${
        open ? ui.priceFieldOpen : ""
      }`}
    >
      <input
        className={ui.priceAmountInput}
        inputMode={inputMode}
        pattern={pattern}
        placeholder={placeholder}
        value={amount}
        disabled={disabled}
        aria-invalid={ariaInvalid ?? invalid}
        aria-describedby={ariaDescribedby}
        onChange={(event) => onAmountChange?.(event.target.value)}
      />
      <div className={ui.priceCurrencyWrap}>
        <button
          type="button"
          className={ui.priceCurrencyBtn}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label="Price currency"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>{selected}</span>
          <span className={ui.priceCurrencyCaret} aria-hidden="true">
            ▼
          </span>
        </button>
        {open ? (
          <ul
            id={listboxId}
            className={ui.priceCurrencyMenu}
            role="listbox"
            aria-label="Currency"
          >
            {OPTIONS.map((option) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === selected}
                  className={`${ui.priceCurrencyOption} ${
                    option.value === selected
                      ? ui.priceCurrencyOptionActive
                      : ""
                  }`}
                  onClick={() => selectCurrency(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
