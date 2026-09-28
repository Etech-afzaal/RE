"use client";

import { FORMAT_SETS, SCREENS, screensForFormat } from "@/lib/ads/formatSets";
import styles from "./ads.module.css";

// "Sizes & images" for the ad form: which sizes the ad has (presets from
// lib/ads/formatSets.js, or custom), one main image every size is made from,
// and a card per size with its preview and an optional custom image.

const SCREEN_NAMES = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };

export const sizeText = (format) => `${format.width}×${format.height}`;

// Largest first, so desktop sizes lead and mobile sizes follow.
export const bySize = (a, b) => b.width * b.height - a.width * a.height || a.id - b.id;

// How far apart two shapes are: 1 = same shape, 2 = one is twice as wide.
function shapeGap(a, b) {
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.max(ra / rb, rb / ra);
}

// Loads a picked file for preview: { file, preview, dims }.
export function readImageFile(file) {
  return new Promise((resolve) => {
    const preview = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () =>
      resolve({ file, preview, dims: { width: img.naturalWidth, height: img.naturalHeight } });
    img.onerror = () => resolve({ file, preview, dims: null });
    img.src = preview;
  });
}

/**
 * What each selected size will show once saved.
 *   kind: "custom-new" | "custom" | "main" | "property" | "missing"
 *   src/exact: preview image; exact = already fitted by the server
 */
export function resolveSizes({ formats, sizeIds, creatives, sizeEdits, main, propertyPhoto }) {
  const saved = new Map((creatives || []).map((creative) => [creative.format_id, creative]));
  return sizeIds
    .map((id) => formats.find((format) => format.id === id))
    .filter(Boolean)
    .sort(bySize)
    .map((format) => {
      const creative = saved.get(format.id);
      const edit = sizeEdits[format.id] || {};
      const fit = edit.fit || creative?.fit || "cover";
      const base = { format, creative, edit, fit };

      if (edit.file) {
        return { ...base, kind: "custom-new", src: edit.preview, sourceDims: edit.dims, fitEditable: true };
      }
      if (creative?.source === "upload" && creative.image_url && !edit.dropCustom) {
        return { ...base, kind: "custom", src: creative.image_url, exact: true, fitEditable: false };
      }
      if (main.src) {
        // The saved image is still right if nothing about it changed.
        const upToDate =
          !main.isNew && creative?.source === "generated" && creative.image_url && fit === creative.fit;
        return {
          ...base,
          kind: "main",
          src: upToDate ? creative.image_url : main.src,
          exact: Boolean(upToDate),
          sourceDims: main.dims,
          fitEditable: true,
        };
      }
      if (propertyPhoto) {
        return { ...base, kind: "property", src: propertyPhoto, fitEditable: false };
      }
      return { ...base, kind: "missing", fitEditable: false };
    });
}

export default function SizesPanel({
  formats,
  sizeIds,
  onSizeIdsChange,
  showCustom,
  onShowCustom,
  views,
  main,
  onMainFile,
  onRemoveMain,
  onUndoRemoveMain,
  onSizeEdit,
  error,
}) {
  const byCode = new Map(formats.map((format) => [format.code, format]));
  const selected = new Set(sizeIds);

  const presets = FORMAT_SETS.map((set) => {
    const codes = [...new Set(SCREENS.map((screen) => set.screens[screen]))];
    const found = codes.map((code) => byCode.get(code));
    const ids = found.filter(Boolean).map((format) => format.id);
    const usable = found.every((format) => format && format.is_active);
    const active =
      ids.length === selected.size && ids.length > 0 && ids.every((id) => selected.has(id));
    // "728×90 · Desktop & tablet"
    const chips = codes.map((code) => ({
      code,
      format: byCode.get(code),
      screens: SCREENS.filter((screen) => set.screens[screen] === code),
    }));
    return { ...set, ids, usable, active, chips };
  });
  const matchesPreset = presets.some((preset) => preset.active);
  const customOpen = showCustom || (!matchesPreset && sizeIds.length > 0);

  function toggleSize(id) {
    onSizeIdsChange(selected.has(id) ? sizeIds.filter((item) => item !== id) : [...sizeIds, id]);
  }

  const customChoices = formats
    .filter((format) => format.is_active || selected.has(format.id))
    .slice()
    .sort(bySize);

  return (
    <div className={styles.stack}>
      <div className={styles.field}>
        <span className={styles.label} id="sizes-label">
          Where it runs <span className={styles.required} aria-label="required">*</span>
        </span>
        <div className={styles.presetGrid} role="radiogroup" aria-labelledby="sizes-label">
          {presets.map((preset) => (
            <label
              key={preset.key}
              className={`${styles.presetOption} ${preset.active && !customOpen ? styles.presetOptionActive : ""} ${preset.usable ? "" : styles.presetOptionDisabled}`}
            >
              <input
                type="radio"
                name="size-preset"
                checked={preset.active && !customOpen}
                disabled={!preset.usable}
                onChange={() => {
                  onShowCustom(false);
                  onSizeIdsChange(preset.ids);
                }}
              />
              <span>
                <span className={styles.presetName}>{preset.name}</span>
                <span className={styles.help}>{preset.hint}</span>
                <span className={styles.chips}>
                  {preset.chips.map((chip) => (
                    <span key={chip.code} className={styles.chip}>
                      <strong>{chip.format ? sizeText(chip.format) : chip.code}</strong>
                      {screenText(chip.screens)}
                    </span>
                  ))}
                </span>
                {!preset.usable && (
                  <span className={styles.checkHint}>A size in this set is missing or turned off.</span>
                )}
              </span>
            </label>
          ))}
          <label className={`${styles.presetOption} ${customOpen ? styles.presetOptionActive : ""}`}>
            <input
              type="radio"
              name="size-preset"
              checked={customOpen}
              onChange={() => onShowCustom(true)}
            />
            <span>
              <span className={styles.presetName}>Custom sizes</span>
              <span className={styles.help}>Pick any sizes, e.g. a sidebar rectangle.</span>
            </span>
          </label>
        </div>
        {customOpen && (
          <div className={styles.sizeChecks} role="group" aria-label="Sizes">
            {customChoices.map((format) => {
              const screens = screensForFormat(format.code);
              return (
                <label
                  key={format.id}
                  className={`${styles.sizeCheck} ${selected.has(format.id) ? styles.sizeCheckActive : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(format.id)}
                    onChange={() => toggleSize(format.id)}
                  />
                  <span>
                    <strong>{format.name}</strong> <span className={styles.mono}>{sizeText(format)}</span>
                    <span className={styles.checkHint}>
                      {screens.length > 0 ? screenText(screens) : format.format_type}
                      {format.is_active ? "" : " · turned off"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <span className={styles.help}>
          The site shows the size that fits the screen: desktop ≥1024px, tablet 768–1023px,
          mobile ≤767px. Every size shares this ad&apos;s schedule, limits and stats.
        </span>
        {error}
      </div>

      <MainImage
        main={main}
        onFile={onMainFile}
        onRemove={onRemoveMain}
        onUndoRemove={onUndoRemoveMain}
      />

      {views.length > 0 && (
        <div className={styles.sizeGrid}>
          {views.map((view) => (
            <SizeCard
              key={view.format.id}
              view={view}
              hasMain={Boolean(main.src)}
              onEdit={(patch) => onSizeEdit(view.format.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function screenText(screens) {
  if (screens.length === SCREENS.length) return "All screens";
  const names = screens.map((screen) => SCREEN_NAMES[screen]);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} & ${names.at(-1).toLowerCase()}`
    : names[0] || "";
}

function MainImage({ main, onFile, onRemove, onUndoRemove }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        Main image <span className={styles.optional}>— every size is made from it</span>
      </span>
      <div className={styles.mainImage}>
        {main.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main.src} alt="Main image" className={styles.mainThumb} />
        ) : (
          <span className={styles.mainThumb}>No image</span>
        )}
        <div className={styles.mainInfo}>
          <span className={styles.help}>
            {main.removed
              ? "Will be removed when you save, with the sizes made from it."
              : main.src
                ? `${main.dims ? `${main.dims.width}×${main.dims.height}` : "Image"}${main.isNew ? " · not saved yet" : ""} · sizes are cropped from it automatically.`
                : "Upload one large image (JPG, PNG or WebP, up to 5 MB). Each size is cropped from it; you can replace any size below."}
          </span>
          <div className={styles.buttonRow} style={{ gap: 8 }}>
            <FileButton label={main.src ? "Replace main image" : "Upload main image"} onFile={onFile} />
            {main.isNew && (
              <button type="button" className={styles.buttonGhost} onClick={onRemove}>
                Clear selection
              </button>
            )}
            {main.src && !main.isNew && (
              <button type="button" className={styles.buttonDanger} onClick={onRemove}>
                Remove
              </button>
            )}
            {main.removed && (
              <button type="button" className={styles.buttonSecondary} onClick={onUndoRemove}>
                Undo remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileButton({ label, onFile, compact = false }) {
  return (
    <label className={`${compact ? styles.buttonGhost : styles.buttonSecondary} ${styles.fileButton}`}>
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

const STATUS = {
  "custom-new": { text: "Custom image · not saved", tone: "toneWarning" },
  custom: { text: "Custom image", tone: "toneSuccess" },
  main: { text: "From main image", tone: "toneSuccess" },
  property: { text: "Property photo", tone: "toneInfo" },
  missing: { text: "Needs an image", tone: "toneDanger" },
};

function SizeCard({ view, hasMain, onEdit }) {
  const { format, kind, src, exact, fit, fitEditable, sourceDims, creative, edit } = view;
  const screens = screensForFormat(format.code);
  const status = STATUS[kind];
  const pendingMain = kind === "main" && !exact;

  const warnings = [];
  if (!format.is_active) warnings.push("This format is turned off, so this size won't show until it's turned on.");
  if (sourceDims && fitEditable) {
    if (fit === "cover" && shapeGap(sourceDims, format) > 1.8) {
      warnings.push("The image is a very different shape, so a lot is cropped. Try “Show whole image” or upload a custom image for this size.");
    }
    const small =
      fit === "cover"
        ? sourceDims.width < format.width || sourceDims.height < format.height
        : sourceDims.width < format.width && sourceDims.height < format.height;
    if (small) warnings.push(`Smaller than ${sizeText(format)}, so it's enlarged and may look soft.`);
  }

  return (
    <div className={styles.sizeCard}>
      <div className={styles.sizeCardHead}>
        <div>
          <span className={styles.sizeName}>
            {format.name} <span className={styles.mono}>{sizeText(format)}</span>
          </span>
          <span className={styles.checkHint}>
            {screens.length > 0 ? screenText(screens) : format.format_type}
          </span>
        </div>
        <span className={`${styles.sizeStatus} ${styles[pendingMain ? "toneWarning" : status.tone]}`}>
          {pendingMain ? "From main image · not saved" : status.text}
        </span>
      </div>

      <SizePreview format={format} src={src} fit={exact ? "exact" : fit} />
      {kind === "property" && (
        <p className={styles.help}>
          No image: the site builds a banner from the property&apos;s photo and details.
        </p>
      )}
      {kind === "missing" && (
        <p className={styles.help}>Upload a main image or a custom image, or link a property with photos.</p>
      )}
      {pendingMain && <p className={styles.help}>Preview is close to the result; the crop keeps the busiest part of the image.</p>}

      {fitEditable && (
        <div className={styles.fitToggle} role="radiogroup" aria-label={`How to fit ${sizeText(format)}`}>
          {[
            ["cover", "Crop to fill"],
            ["contain", "Show whole image"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={fit === value}
              className={fit === value ? styles.fitToggleOn : ""}
              onClick={() => onEdit({ fit: value })}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {warnings.map((text) => (
        <p key={text} className={styles.fitWarning}>
          {text}
        </p>
      ))}

      <div className={styles.buttonRow} style={{ gap: 4 }}>
        <FileButton
          compact
          label={kind === "custom" || kind === "custom-new" ? "Replace custom image" : "Upload custom image"}
          onFile={(file) => onEdit({ file, dropCustom: false })}
        />
        {kind === "custom-new" && (
          <button type="button" className={styles.buttonGhost} onClick={() => onEdit({ file: null })}>
            Clear selection
          </button>
        )}
        {kind === "custom" && (
          <button
            type="button"
            className={styles.buttonGhost}
            style={hasMain ? undefined : { color: "var(--danger)" }}
            onClick={() => onEdit({ dropCustom: true })}
          >
            {hasMain ? "Use main image instead" : "Remove custom image"}
          </button>
        )}
        {edit.dropCustom && creative?.source === "upload" && !edit.file && (
          <button type="button" className={styles.buttonGhost} onClick={() => onEdit({ dropCustom: false })}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

// fit: "exact" (already the right size), "cover" or "contain" (CSS approximation
// of the server's fitting in lib/ads/images.js).
export function SizePreview({ format, src, fit = "exact" }) {
  // Full width of the card, capped at the real size, always the size's shape.
  const box = {
    width: "100%",
    maxWidth: format.width,
    height: "auto",
    aspectRatio: `${format.width} / ${format.height}`,
  };
  return (
    <div className={`${styles.previewFrame} ${styles.sizePreview}`}>
      {src && fit === "contain" ? (
        <div className={styles.previewContain} style={box}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden="true" className={styles.previewBlur} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${sizeText(format)} preview`} className={styles.previewWhole} />
        </div>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${sizeText(format)} preview`} style={{ ...box, objectFit: "cover" }} />
      ) : (
        <div className={styles.previewPlaceholder} style={box}>
          {sizeText(format)}
        </div>
      )}
    </div>
  );
}
