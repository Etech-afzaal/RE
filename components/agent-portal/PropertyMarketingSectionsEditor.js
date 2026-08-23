"use client";

import { useEffect, useRef, useState } from "react";
import { MARKETING_LIMITS } from "@/lib/propertyMarketingSections";
import ui from "./portal.module.css";

const HIGHLIGHT_SUGGESTIONS = [
  "Thoughtful Design",
  "Prime Location",
  "Family Friendly",
  "Spacious Layout",
  "Modern Construction",
  "Natural Light",
  "Secure Community",
  "Excellent Connectivity",
];
const WHY_SUGGESTIONS = [
  "Peaceful residential environment",
  "Close to schools and markets",
  "Ideal family location",
  "Modern lifestyle",
  "Excellent accessibility",
  "Strong investment potential",
];
const LOCATION_SUGGESTIONS = [
  "Main Boulevard",
  "School",
  "Hospital",
  "Mosque",
  "Shopping Area",
  "Restaurant",
  "Park",
  "Airport",
  "Public Transport",
];
const INVESTMENT_SUGGESTIONS = [
  "Strong rental potential",
  "High-demand location",
  "Long-term appreciation potential",
  "Growing neighborhood",
  "Excellent resale potential",
  "Suitable for rental income",
];
const HIGHLIGHT_ICONS = ["home", "pin", "family", "space", "sun", "car"];

/** Same SVG mapping as the public property detail HighlightIcon. */
function HighlightIcon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
  };

  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "car") {
    return (
      <svg {...common}>
        <path
          d="M4 15.5h16l-1.2-4.2a2 2 0 0 0-1.9-1.4H7.1a2 2 0 0 0-1.9 1.4L4 15.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 15.5v2M17.5 15.5v2M7.5 10l1-3h7l1 3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...common}>
        <path
          d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "family") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4.5 18.5c.6-3 2.5-4.5 4.5-4.5s3.9 1.5 4.5 4.5M13.5 18.5c.3-1.8 1.3-2.8 2.5-2.8 1.4 0 2.4 1.2 2.7 2.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "space") {
    return (
      <svg {...common}>
        <path
          d="M4 9.5 12 4l8 5.5V20H4V9.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M4 10.5 12 4l8 6.5V20H4v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 20v-5.5h5V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HighlightIconSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = value || "home";

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={ui.iconSelectWrap} ref={wrapRef}>
      <button
        type="button"
        className={ui.iconSelectTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={ui.iconSelectGlyph} aria-hidden="true">
          <HighlightIcon name={selected} size={18} />
        </span>
        <span className={ui.iconSelectLabel}>{selected}</span>
        <svg
          className={ui.iconSelectChevron}
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul className={ui.iconSelectMenu} role="listbox" aria-label="Highlight icon">
          {HIGHLIGHT_ICONS.map((icon) => (
            <li key={icon} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selected === icon}
                className={`${ui.iconSelectOption} ${
                  selected === icon ? ui.iconSelectOptionActive : ""
                }`.trim()}
                onClick={() => {
                  onChange(icon);
                  setOpen(false);
                }}
              >
                <span className={ui.iconSelectGlyph} aria-hidden="true">
                  <HighlightIcon name={icon} size={18} />
                </span>
                <span>{icon}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function useHelpers(form, setForm) {
  const arr = (key) => form[key] || [];
  return {
    highlights: {
      list: arr("property_highlights"),
      add: (item) =>
        setForm((prev) => ({
          ...prev,
          property_highlights: [...(prev.property_highlights || []), item],
        })),
      remove: (i) =>
        setForm((prev) => ({
          ...prev,
          property_highlights: (prev.property_highlights || []).filter(
            (_, idx) => idx !== i,
          ),
        })),
      set: (i, changes) =>
        setForm((prev) => ({
          ...prev,
          property_highlights: (prev.property_highlights || []).map(
            (item, idx) => (idx === i ? { ...item, ...changes } : item),
          ),
        })),
    },
    why: {
      list: arr("why_this_home"),
      add: (value) =>
        setForm((prev) => ({
          ...prev,
          why_this_home: [...(prev.why_this_home || []), value],
        })),
      remove: (i) =>
        setForm((prev) => ({
          ...prev,
          why_this_home: (prev.why_this_home || []).filter(
            (_, idx) => idx !== i,
          ),
        })),
      set: (i, value) =>
        setForm((prev) => ({
          ...prev,
          why_this_home: (prev.why_this_home || []).map((item, idx) =>
            idx === i ? value : item,
          ),
        })),
    },
    locations: {
      list: arr("location_advantages"),
      add: (item) =>
        setForm((prev) => ({
          ...prev,
          location_advantages: [...(prev.location_advantages || []), item],
        })),
      remove: (i) =>
        setForm((prev) => ({
          ...prev,
          location_advantages: (prev.location_advantages || []).filter(
            (_, idx) => idx !== i,
          ),
        })),
      set: (i, changes) =>
        setForm((prev) => ({
          ...prev,
          location_advantages: (prev.location_advantages || []).map(
            (item, idx) => (idx === i ? { ...item, ...changes } : item),
          ),
        })),
    },
    insights: {
      list: arr("investment_insights"),
      add: (value) =>
        setForm((prev) => ({
          ...prev,
          investment_insights: [...(prev.investment_insights || []), value],
        })),
      remove: (i) =>
        setForm((prev) => ({
          ...prev,
          investment_insights: (prev.investment_insights || []).filter(
            (_, idx) => idx !== i,
          ),
        })),
      set: (i, value) =>
        setForm((prev) => ({
          ...prev,
          investment_insights: (prev.investment_insights || []).map(
            (item, idx) => (idx === i ? value : item),
          ),
        })),
    },
  };
}

function Chips({ suggestions, onAdd, disabled, used }) {
  return (
    <div className={ui.suggestionChips}>
      {suggestions.map((s) => {
        const isUsed = used(s);
        return (
          <button
            key={s}
            type="button"
            className={ui.suggestionChip}
            disabled={isUsed || disabled}
            onClick={() => onAdd(s)}
          >
            + {s}
          </button>
        );
      })}
    </div>
  );
}

export default function PropertyMarketingSectionsEditor({ form, setForm }) {
  const h = useHelpers(form, setForm);

  return (
    <div>
      {/* Property Highlights */}
      <div className={ui.marketingSection}>
        <span className={ui.label}>
          Property Highlights{" "}
          <span className={ui.muted}>
            (optional · max {MARKETING_LIMITS.propertyHighlights})
          </span>
        </span>
        <p className={ui.muted}>
          Highlight cards shown on the public property page. Pick a suggestion
          or create your own.
        </p>
        <Chips
          suggestions={HIGHLIGHT_SUGGESTIONS}
          used={(s) => h.highlights.list.some((item) => item.title === s)}
          disabled={h.highlights.list.length >= MARKETING_LIMITS.propertyHighlights}
          onAdd={(title) => h.highlights.add({ title, description: "", icon: "home" })}
        />
        {h.highlights.list.map((item, i) => (
          <div key={i} className={ui.marketingItem}>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.imageCardLabel}>Title</span>
                <input
                  className={ui.input}
                  value={item.title || ""}
                  onChange={(e) => h.highlights.set(i, { title: e.target.value })}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.imageCardLabel}>Icon</span>
                <HighlightIconSelect
                  value={item.icon || "home"}
                  onChange={(icon) => h.highlights.set(i, { icon })}
                />
              </label>
            </div>
            <label className={ui.field}>
              <span className={ui.imageCardLabel}>Description</span>
              <input
                className={ui.input}
                value={item.description || ""}
                onChange={(e) =>
                  h.highlights.set(i, { description: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className={ui.btnTextDanger}
              onClick={() => h.highlights.remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Why This Home */}
      <div className={ui.marketingSection}>
        <span className={ui.label}>
          Why This Home?{" "}
          <span className={ui.muted}>
            (optional · max {MARKETING_LIMITS.whyThisHome})
          </span>
        </span>
        <p className={ui.muted}>
          Checklist shown on the public page. Edit the suggestions or type your
          own.
        </p>
        <Chips
          suggestions={WHY_SUGGESTIONS}
          used={(s) => h.why.list.includes(s)}
          disabled={h.why.list.length >= MARKETING_LIMITS.whyThisHome}
          onAdd={(s) => h.why.add(s)}
        />
        {h.why.list.map((item, i) => (
          <div key={i} className={ui.marketingItem}>
            <input
              className={ui.input}
              value={item}
              onChange={(e) => h.why.set(i, e.target.value)}
            />
            <button
              type="button"
              className={ui.btnTextDanger}
              onClick={() => h.why.remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Location Advantages */}
      <div className={ui.marketingSection}>
        <span className={ui.label}>
          Location Advantages{" "}
          <span className={ui.muted}>
            (optional · max {MARKETING_LIMITS.locationAdvantages})
          </span>
        </span>
        <p className={ui.muted}>
          Nearby places shown on the public page. Use the suggestions or enter
          custom places.
        </p>
        <Chips
          suggestions={LOCATION_SUGGESTIONS}
          used={(s) => h.locations.list.some((item) => item.name === s)}
          disabled={
            h.locations.list.length >= MARKETING_LIMITS.locationAdvantages
          }
          onAdd={(name) => h.locations.add({ name, description: "" })}
        />
        {h.locations.list.map((item, i) => (
          <div key={i} className={ui.marketingItem}>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.imageCardLabel}>Place/Location</span>
                <input
                  className={ui.input}
                  value={item.name || ""}
                  onChange={(e) =>
                    h.locations.set(i, { name: e.target.value })
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.imageCardLabel}>Description / distance</span>
                <input
                  className={ui.input}
                  value={item.description || ""}
                  onChange={(e) =>
                    h.locations.set(i, { description: e.target.value })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className={ui.btnTextDanger}
              onClick={() => h.locations.remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Investment Insights */}
      <div className={ui.marketingSection}>
        <span className={ui.label}>
          Investment Insight{" "}
          <span className={ui.muted}>
            (optional · max {MARKETING_LIMITS.investmentInsights})
          </span>
        </span>
        <p className={ui.muted}>
          Investment checklist shown on the public page. Edit the suggestions
          or create custom insights.
        </p>
        <Chips
          suggestions={INVESTMENT_SUGGESTIONS}
          used={(s) => h.insights.list.includes(s)}
          disabled={
            h.insights.list.length >= MARKETING_LIMITS.investmentInsights
          }
          onAdd={(s) => h.insights.add(s)}
        />
        {h.insights.list.map((item, i) => (
          <div key={i} className={ui.marketingItem}>
            <input
              className={ui.input}
              value={item}
              onChange={(e) => h.insights.set(i, e.target.value)}
            />
            <button
              type="button"
              className={ui.btnTextDanger}
              onClick={() => h.insights.remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}