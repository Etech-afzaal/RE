"use client";

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
      <div className={ui.field}>
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
                <select
                  className={ui.select}
                  value={item.icon || "home"}
                  onChange={(e) => h.highlights.set(i, { icon: e.target.value })}
                >
                  {HIGHLIGHT_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
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
      <div className={ui.field}>
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
      <div className={ui.field}>
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
      <div className={ui.field}>
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