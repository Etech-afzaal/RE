/**
 * Agent public website theme engine.
 *
 * Centralizes theme resolution, validation and CSS-variable mapping so the
 * Agent Public Website + Agent Property Detail pages can be themed per agent
 * without touching component structure or layout.
 *
 * Flow:
 *   visitor opens agent website → find agent → resolve theme → apply CSS
 *   variables on the `.agent-public-theme` wrapper → existing components
 *   consume the variables (see app/agent-public-theme.css).
 *
 * The DEFAULT theme resolves to `null` (no inline override) so the existing
 * CSS variable defaults apply and existing agents render pixel-identical.
 */
import {
  DEFAULT_THEME_ID,
  CUSTOM_THEME_ID,
  getThemeDefinition,
  PREDEFINED_THEMES,
} from "@/themes";

/** Fields a custom palette editor exposes (and what we persist). */
export const CUSTOM_PALETTE_FIELDS = Object.freeze([
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
]);

// ---------------------------------------------------------------------------
// Color helpers (tiny, dependency-free)
// ---------------------------------------------------------------------------

/** Normalize a hex color to `#rrggbb` (lowercase). Returns `null` if invalid. */
export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  let hex = value.trim();
  if (!hex) return null;
  if (hex[0] !== "#") hex = `#${hex}`;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}

/** True for a parseable 3- or 6-digit hex color (with or without #). */
export function isValidHex(value) {
  return normalizeHex(value) !== null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function clampChannel(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => clampChannel(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Mix two hex colors. weight 0 → a, 1 → b. */
export function mix(a, b, weight) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return normalizeHex(a) || normalizeHex(b) || "#000000";
  const t = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/** Lighten a hex color toward white. amount 0..1. */
export function lighten(hex, amount) {
  return mix(hex, "#ffffff", amount);
}

/** Darken a hex color toward black. amount 0..1. */
export function darken(hex, amount) {
  return mix(hex, "#000000", amount);
}

/** `rgba(r, g, b, a)` string from a hex color. Falls back to transparent. */
function toRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(0,0,0,0)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Custom palette normalization + validation
// ---------------------------------------------------------------------------

function asObject(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Build a full logical palette from the 6 user-editable custom colors.
 * Derived shades keep custom palettes visually coherent.
 * @param {unknown} raw
 * @returns {object|null} full palette, or null if the required colors are missing/invalid.
 */
export function normalizeCustomPalette(raw) {
  const input = asObject(raw);
  if (!input) return null;

  const primary = normalizeHex(input.primary);
  const accent = normalizeHex(input.accent);
  const background = normalizeHex(input.background);
  const surface = normalizeHex(input.surface);
  const text = normalizeHex(input.text);
  // secondary is optional — default to white for contrast on dark CTAs.
  const secondary = normalizeHex(input.secondary) || "#ffffff";

  // Required colors must all be valid hex.
  if (!primary || !accent || !background || !surface || !text) return null;

  return {
    primary,
    secondary,
    accent,
    accentSecondary: darken(accent, 0.3),
    accentSoft: lighten(accent, 0.22),
    accentTint: lighten(accent, 0.85),
    background,
    surface,
    text,
    textSoft: mix(text, "#9aa0a8", 0.5),
    mutedText: mix(text, "#b8bcc2", 0.7),
    border: mix(surface, text, 0.92),
    buttonPrimary: primary,
    buttonSecondary: accent,
  };
}

/**
 * Validate a custom palette payload from the settings API.
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateCustomPaletteInput(raw) {
  const input = asObject(raw);
  if (!input) {
    return { ok: false, error: "Custom palette is required." };
  }
  for (const field of CUSTOM_PALETTE_FIELDS) {
    if (!normalizeHex(input[field])) {
      return { ok: false, error: `Invalid color for ${field}.` };
    }
  }
  const palette = normalizeCustomPalette(input);
  if (!palette) {
    return { ok: false, error: "Could not build palette from the provided colors." };
  }
  // Persist only the 6 user-editable fields.
  const persisted = {};
  for (const field of CUSTOM_PALETTE_FIELDS) {
    persisted[field] = normalizeHex(input[field]);
  }
  return { ok: true, value: persisted };
}

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an agent's stored theme to a full logical palette.
 * Returns `null` for the default theme (no override needed — the CSS defaults
 * in agent-public-theme.css already match the default palette exactly).
 *
 * @param {{ theme_id?: string, theme_settings?: unknown } | null} agent
 * @returns {object|null}
 */
export function resolveAgentPalette(agent) {
  if (!agent) return null;
  const themeId = String(agent.theme_id || DEFAULT_THEME_ID).trim() || DEFAULT_THEME_ID;

  if (themeId === DEFAULT_THEME_ID) return null;

  if (themeId === CUSTOM_THEME_ID) {
    const palette = normalizeCustomPalette(agent.theme_settings);
    // Invalid custom settings fall back to the default theme (no override).
    return palette || null;
  }

  const definition = getThemeDefinition(themeId);
  if (!definition) return null;
  return definition.palette;
}

/**
 * Map a logical palette to the CSS variable names consumed by the public
 * components (legacy tokens defined in agent-public-theme.css) plus canonical
 * `--theme-*` aliases for clarity/future use.
 * @param {object} p full logical palette
 * @returns {Record<string, string>}
 */
export function paletteToCssVars(p) {
  return {
    // Canonical theme aliases
    "--theme-primary": p.primary,
    "--theme-secondary": p.secondary,
    "--theme-accent": p.accent,
    "--theme-background": p.background,
    "--theme-surface": p.surface,
    "--theme-text": p.text,
    "--theme-muted": p.mutedText,
    "--theme-border": p.border,
    "--theme-button-primary": p.buttonPrimary,
    "--theme-button-secondary": p.buttonSecondary,

    // Legacy tokens consumed by existing components
    "--paper": p.background,
    "--surface": p.surface,
    "--surface-sunken": p.background,
    "--surface-secondary": p.background,
    "--ink": p.text,
    "--ink-soft": p.textSoft,
    "--muted": p.mutedText,
    "--gold": p.accent,
    "--gold-soft": p.accentSoft,
    "--gold-deep": p.primary,
    "--gold-tint": p.accentTint,
    "--brass": p.accent,
    "--brass-deep": p.accentSecondary,
    "--brass-light": p.accentSoft,
    "--brass-tint": p.accentTint,
    "--shadow-gold": `0 10px 28px ${toRgba(p.accent, 0.28)}`,
    "--agent-black": p.primary,
    "--agent-white": p.secondary,
    "--agent-bg": p.background,
    "--agent-accent": p.accent,
    "--agent-accent-secondary": p.accentSecondary,
    "--cta-bg": p.buttonPrimary,
    "--cta-fg": p.secondary,
    "--cta-hover-bg": p.buttonSecondary,
    "--cta-hover-fg": p.primary,
    "--cta-shadow": `0 10px 28px ${toRgba(p.primary, 0.22)}`,
    "--verified-bg": p.accentTint,
    "--verified-fg": p.accentSecondary,
    "--verified-border": p.accent,
    "--nav-link-active-color": p.accent,
  };
}

/**
 * Resolve an agent's theme to a React inline-style object of CSS variables,
 * applied on the `.agent-public-theme` wrapper to override the CSS defaults.
 * Returns `null` for the default theme so the site stays pixel-identical.
 *
 * @param {{ theme_id?: string, theme_settings?: unknown } | null} agent
 * @returns {Record<string, string> | null}
 */
export function resolveAgentThemeStyle(agent) {
  const palette = resolveAgentPalette(agent);
  if (!palette) return null;
  return paletteToCssVars(palette);
}

/**
 * Resolve an agent's theme to the 6-field custom palette (for the editor),
 * regardless of whether the current theme is predefined or custom.
 * Returns `null` when there is no meaningful custom representation (default).
 *
 * @param {{ theme_id?: string, theme_settings?: unknown } | null} agent
 * @returns {object|null}
 */
export function resolveAgentCustomPalette(agent) {
  if (!agent) return null;
  const themeId = String(agent.theme_id || DEFAULT_THEME_ID).trim() || DEFAULT_THEME_ID;
  if (themeId === DEFAULT_THEME_ID) return null;

  if (themeId === CUSTOM_THEME_ID) {
    return normalizeCustomPalette(agent.theme_settings);
  }

  const definition = getThemeDefinition(themeId);
  if (!definition) return null;
  const p = definition.palette;
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    background: p.background,
    surface: p.surface,
    text: p.text,
  };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Themes for the dashboard selector. Each entry includes small preview
 * swatches so cards can render a color preview without importing the palette.
 * The custom entry is appended last.
 */
export const THEMES_FOR_UI = Object.freeze([
  ...PREDEFINED_THEMES.map((theme) =>
    Object.freeze({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      isCustom: false,
      swatches: Object.freeze([
        theme.palette.primary,
        theme.palette.accent,
        theme.palette.background,
      ]),
    }),
  ),
  Object.freeze({
    id: CUSTOM_THEME_ID,
    name: "Custom Palette",
    description: "Pick your own colors.",
    isCustom: true,
    swatches: Object.freeze(["#111111", "#c8a45d", "#ffffff"]),
  }),
]);

/**
 * Summary of an agent's current theme (for the settings UI + API GET).
 * @param {{ theme_id?: string, theme_settings?: unknown } | null} agent
 */
export function getThemeSummary(agent) {
  const themeId = String(agent?.theme_id || DEFAULT_THEME_ID).trim() || DEFAULT_THEME_ID;
  if (themeId === CUSTOM_THEME_ID) {
    const palette = normalizeCustomPalette(agent?.theme_settings);
    return {
      theme_id: CUSTOM_THEME_ID,
      theme_name: palette ? "Custom Palette" : "Classic Luxury",
      is_custom: true,
      has_settings: Boolean(palette),
      custom_palette: palette
        ? {
            primary: palette.primary,
            secondary: palette.secondary,
            accent: palette.accent,
            background: palette.background,
            surface: palette.surface,
            text: palette.text,
          }
        : null,
    };
  }
  const definition = getThemeDefinition(themeId);
  return {
    theme_id: definition ? themeId : DEFAULT_THEME_ID,
    theme_name: definition ? definition.name : "Classic Luxury",
    is_custom: false,
    has_settings: false,
    custom_palette: null,
  };
}

export { DEFAULT_THEME_ID, CUSTOM_THEME_ID };
