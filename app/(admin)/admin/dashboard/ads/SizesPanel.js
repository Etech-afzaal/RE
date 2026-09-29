"use client";

import { useState } from "react";
import { ImageIcon, ImagePlus, Trash2, Undo2, Upload } from "lucide-react";
import { SCREENS, screensForFormat } from "@/lib/ads/formatSets";
import styles from "./ads.module.css";
import f from "./adForm.module.css";

// "Sizes & images" for the ad form: the sizes the ad's locations need, one
// main image every size is made from, and a card per size with its preview
// and an optional custom image.

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

// "Sizes & images": the sizes follow from the ad's locations (all locations
// use the Billboard set), so this only shows them and handles the images.
export default function SizesPanel({
  views,
  main,
  onMainFile,
  onRemoveMain,
  onUndoRemoveMain,
  onSizeEdit,
}) {
  return (
    <>
      <div className={f.group}>
        <div className={f.groupHead}>
          <span className={f.groupTitle}>Sizes</span>
          <span className={f.groupHint}>
            Set by the locations. Each screen gets the size that fits: desktop ≥1024px, tablet
            768–1023px, mobile ≤767px.
          </span>
        </div>
        {views.length > 0 ? (
          <div className={f.chips}>
            {views.map(({ format }) => (
              <span key={format.id} className={f.chip}>
                <strong>{sizeText(format)}</strong>
                {screenText(screensForFormat(format.code)) || capitalize(format.format_type)}
              </span>
            ))}
          </div>
        ) : (
          <span className={f.help}>Choose a location above to see the sizes it needs.</span>
        )}
      </div>

      <div className={f.group}>
        <div className={f.groupHead}>
          <span className={f.groupTitle}>Images</span>
          <span className={f.groupHint}>
            Upload one main image and each size is cropped from it. Replace any size with its own
            design.
          </span>
        </div>
        <div className={f.imageGrid}>
          <MainImage
            main={main}
            onFile={onMainFile}
            onRemove={onRemoveMain}
            onUndoRemove={onUndoRemoveMain}
          />
          {views.map((view) => (
            <SizeCard
              key={view.format.id}
              view={view}
              hasMain={Boolean(main.src)}
              onEdit={(patch) => onSizeEdit(view.format.id, patch)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : "");

function screenText(screens) {
  if (screens.length === SCREENS.length) return "All screens";
  const names = screens.map((screen) => SCREEN_NAMES[screen]);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} & ${names.at(-1).toLowerCase()}`
    : names[0] || "";
}

// Lets a tile accept a dropped image file.
function useDropTarget(onFile) {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    handlers: {
      onDragOver: (e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (e) => {
        e.preventDefault();
        setDragging(false);
        const file = [...e.dataTransfer.files].find((item) => item.type.startsWith("image/"));
        if (file) onFile(file);
      },
    },
  };
}

const ACCEPT = "image/jpeg,image/png,image/webp";

function pickedFile(e, onFile) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) onFile(file);
}

function MainImage({ main, onFile, onRemove, onUndoRemove }) {
  const { dragging, handlers } = useDropTarget(onFile);
  return (
    <div className={`${f.tile} ${dragging ? f.tileDragging : ""}`} {...handlers}>
      <div className={f.tileHead}>
        <div>
          <span className={f.tileTitle}>Main image</span>
          <span className={f.tileSub}>Every size is made from it</span>
        </div>
        {main.src && (
          <span className={`${f.status} ${styles[main.isNew ? "toneWarning" : "toneSuccess"]}`}>
            {main.isNew ? "Not saved yet" : "Uploaded"}
          </span>
        )}
      </div>

      {main.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={main.src} alt="Main image" className={f.mainPreview} />
      ) : (
        <label className={f.dropzone}>
          <ImagePlus size={26} aria-hidden="true" />
          <strong>{main.removed ? "Main image will be removed" : "Upload main image"}</strong>
          <span className={f.help}>Drop a file here or click · JPG, PNG or WebP · up to 5 MB</span>
          <input type="file" accept={ACCEPT} onChange={(e) => pickedFile(e, onFile)} />
        </label>
      )}

      <span className={f.help}>
        {main.removed
          ? "Sizes made from it are removed when you save."
          : main.src
            ? `${main.dims ? `${main.dims.width}×${main.dims.height} · ` : ""}Use a large image for sharp results.`
            : "Tip: 2000px wide or more looks sharp on every screen."}
      </span>

      <div className={f.tileActions}>
        {main.src && (
          <label className={f.fileButton}>
            <Upload size={14} aria-hidden="true" /> Replace
            <input type="file" accept={ACCEPT} onChange={(e) => pickedFile(e, onFile)} />
          </label>
        )}
        {main.isNew && (
          <button type="button" className={f.link} onClick={onRemove}>
            Clear selection
          </button>
        )}
        {main.src && !main.isNew && (
          <button type="button" className={`${f.link} ${f.linkDanger}`} onClick={onRemove}>
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        )}
        {main.removed && (
          <button type="button" className={f.link} onClick={onUndoRemove}>
            <Undo2 size={14} aria-hidden="true" /> Undo remove
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS = {
  "custom-new": { text: "Custom · not saved", tone: "toneWarning" },
  custom: { text: "Custom image", tone: "toneSuccess" },
  main: { text: "From main image", tone: "toneSuccess" },
  property: { text: "Property photo", tone: "toneInfo" },
  missing: { text: "Needs an image", tone: "toneDanger" },
};

function SizeCard({ view, hasMain, onEdit }) {
  const { format, kind, src, exact, fit, fitEditable, sourceDims, creative, edit } = view;
  const screens = screensForFormat(format.code);
  const pendingMain = kind === "main" && !exact;
  const status = pendingMain
    ? { text: "From main · not saved", tone: "toneWarning" }
    : STATUS[kind];
  const { dragging, handlers } = useDropTarget((file) => onEdit({ file, dropCustom: false }));

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
    <div className={`${f.tile} ${dragging ? f.tileDragging : ""}`} {...handlers}>
      <div className={f.tileHead}>
        <div>
          <span className={f.tileTitle}>
            {format.name}
            <span className={f.mono}>{sizeText(format)}</span>
          </span>
          <span className={f.tileSub}>
            {screens.length > 0 ? screenText(screens) : capitalize(format.format_type)}
          </span>
        </div>
        <span className={`${f.status} ${styles[status.tone]}`}>{status.text}</span>
      </div>

      <SizePreview format={format} src={src} fit={exact ? "exact" : fit} />
      {kind === "property" && (
        <span className={f.help}>
          No image: the site builds a banner from the property&apos;s photo and details.
        </span>
      )}
      {kind === "missing" && (
        <span className={f.help}>
          Upload a main image or a custom image, or link a property with photos.
        </span>
      )}
      {pendingMain && (
        <span className={f.help}>Preview is close to the result; the crop keeps the busiest part.</span>
      )}

      {fitEditable && (
        <div className={f.fitToggle} role="radiogroup" aria-label={`How to fit ${sizeText(format)}`}>
          {[
            ["cover", "Crop to fill"],
            ["contain", "Show whole image"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={fit === value}
              className={fit === value ? f.fitOn : ""}
              onClick={() => onEdit({ fit: value })}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {warnings.map((text) => (
        <p key={text} className={f.warn}>
          {text}
        </p>
      ))}

      <div className={f.tileActions}>
        <label className={f.fileButton}>
          <Upload size={14} aria-hidden="true" />
          {kind === "custom" || kind === "custom-new" ? "Replace custom image" : "Upload custom image"}
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) => pickedFile(e, (file) => onEdit({ file, dropCustom: false }))}
          />
        </label>
        {kind === "custom-new" && (
          <button type="button" className={f.link} onClick={() => onEdit({ file: null })}>
            Clear selection
          </button>
        )}
        {kind === "custom" && (
          <button
            type="button"
            className={`${f.link} ${hasMain ? "" : f.linkDanger}`}
            onClick={() => onEdit({ dropCustom: true })}
          >
            {hasMain ? "Use main image instead" : "Remove custom image"}
          </button>
        )}
        {edit.dropCustom && creative?.source === "upload" && !edit.file && (
          <button type="button" className={f.link} onClick={() => onEdit({ dropCustom: false })}>
            <Undo2 size={14} aria-hidden="true" /> Undo
          </button>
        )}
      </div>
    </div>
  );
}

// fit: "exact" (already the right size), "cover" or "contain" (CSS approximation
// of the server's fitting in lib/ads/images.js). Used by the form and the ad page.
export function SizePreview({ format, src, fit = "exact" }) {
  // Full width of its container, capped at the real size, always the size's shape.
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
          <ImageIcon size={18} aria-hidden="true" />
          {sizeText(format)}
        </div>
      )}
    </div>
  );
}
