"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import styles from "./LocationAutocomplete.module.css";

export default function LocationAutocomplete({
  className = "",
  value = "",
  onChange,
  placeholder,
  maxLength,
  ariaInvalid,
  ariaDescribedBy,
  disabled = false,
  types = ["geocode"],
  country = "pk",
  locationBias = null,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [googleReady, setGoogleReady] = useState(false);
  const debounceRef = useRef(null);
  const autocompleteRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled) return;
        if (window.google?.maps?.places?.AutocompleteService) {
          autocompleteRef.current =
            new window.google.maps.places.AutocompleteService();
          setGoogleReady(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleReady || !autocompleteRef.current) return;
    const trimmed = String(value || "").trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const input = locationBias ? `${trimmed} ${locationBias}` : trimmed;
      autocompleteRef.current.getPlacePredictions(
        {
          input,
          types,
          componentRestrictions: { country },
        },
        (predictions, status) => {
          if (
            status !== window.google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            setSuggestions([]);
            return;
          }
          setSuggestions(predictions.slice(0, 6));
        },
      );
    }, 120);

    return () => clearTimeout(debounceRef.current);
  }, [value, googleReady, types, country, locationBias]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(prediction) {
    const mainText =
      prediction.structured_formatting?.main_text || prediction.description;
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
    onChange?.({ target: { value: mainText } });
  }

  function handleKeyDown(e) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={styles.autocompleteWrap} ref={wrapRef}>
      <input
        className={className}
        value={value}
        onChange={(e) => {
          setShowDropdown(true);
          onChange?.(e);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 ? (
        <ul className={styles.dropdown} role="listbox">
          {suggestions.map((prediction, index) => (
            <li
              key={prediction.place_id}
              role="option"
              aria-selected={index === activeIndex}
              className={`${styles.dropdownItem} ${
                index === activeIndex ? styles.dropdownItemActive : ""
              }`.trim()}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(prediction);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className={styles.mainText}>
                {prediction.structured_formatting?.main_text ||
                  prediction.description}
              </span>
              {prediction.structured_formatting?.secondary_text ? (
                <span className={styles.secondaryText}>
                  {prediction.structured_formatting.secondary_text}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
