"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import {
  AD_LOCATIONS,
  LOCATION_PAGES,
  locationLabel,
} from "@/lib/ads/locations";
import f from "./adForm.module.css";

// Multi-select dropdown of ad locations (lib/ads/locations.js), grouped by page.
// `value` is an array of location keys, kept in AD_LOCATIONS order.
export default function LocationPicker({
  id,
  value,
  onChange,
  invalid = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const selected = new Set(value);
  const allSelected = selected.size === AD_LOCATIONS.length;

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (keys) =>
    onChange(AD_LOCATIONS.map((l) => l.key).filter((key) => keys.has(key)));
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next);
  };
  const togglePage = (locations) => {
    const next = new Set(selected);
    const allOn = locations.every((l) => next.has(l.key));
    locations.forEach((l) => (allOn ? next.delete(l.key) : next.add(l.key)));
    commit(next);
  };

  return (
    <div className={f.locPicker} ref={rootRef}>
      {/* The menu hangs from the button, above the selected-location chips. */}
      <div className={f.locAnchor}>
        <button
          id={id}
          type="button"
          className={`${f.locTrigger} ${invalid ? f.locTriggerInvalid : ""}`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <MapPin size={16} aria-hidden="true" />
          <span className={selected.size ? f.locValue : f.locPlaceholder}>
            {selected.size === 0
              ? "Choose where this ad shows…"
              : allSelected
                ? `All ${AD_LOCATIONS.length} locations`
                : `${selected.size} location${selected.size === 1 ? "" : "s"} selected`}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={open ? f.locChevronOpen : ""}
          />
        </button>

        {open && (
          <div
            id={menuId}
            className={f.locMenu}
            role="group"
            aria-label="Ad locations"
          >
            <div className={f.locMenuHead}>
              <span>
                {selected.size} of {AD_LOCATIONS.length} selected
              </span>
              <button
                type="button"
                className={f.link}
                onClick={() =>
                  commit(
                    new Set(allSelected ? [] : AD_LOCATIONS.map((l) => l.key)),
                  )
                }
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            {LOCATION_PAGES.map(({ page, locations }) => {
              const on = locations.filter((l) => selected.has(l.key)).length;
              return (
                <div key={page} className={f.locGroup}>
                  <button
                    type="button"
                    className={f.locGroupHead}
                    onClick={() => togglePage(locations)}
                  >
                    <span>{page}</span>
                    <span className={f.locGroupCount}>
                      {on === locations.length ? "Clear page" : "Select page"}
                    </span>
                  </button>
                  {locations.map((location) => {
                    const checked = selected.has(location.key);
                    return (
                      <label
                        key={location.key}
                        className={`${f.locOption} ${checked ? f.locOptionOn : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(location.key)}
                        />
                        <span
                          className={`${f.marker} ${f.markerSquare}`}
                          aria-hidden="true"
                        >
                          {checked && <Check size={13} strokeWidth={3.5} />}
                        </span>
                        <span>{location.spot}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            <div className={f.locMenuFoot}>
              <button
                type="button"
                className={f.btnSecondary}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <ul className={f.locChips} aria-label="Selected locations">
          {value.map((key) => (
            <li key={key} className={f.locChip}>
              {locationLabel(key)}
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-label={`Remove ${locationLabel(key)}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
