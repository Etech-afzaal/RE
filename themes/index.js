/**
 * Centralized theme registry for the Agent Public Website + Property Detail pages.
 *
 * Each predefined theme lives in its own file and exports a definition:
 *   { id, name, description, palette: { ...logical colors } }
 *
 * The "default" theme (Classic Luxury) mirrors the existing site colors exactly
 * so existing agents render unchanged. Custom palettes (theme_id = "custom")
 * are user-defined and stored in `users.theme_settings` — see lib/agentTheme.js.
 *
 * Do not scatter color values across components. Add a new theme here, then it
 * becomes available everywhere via `getThemeDefinition()` / `THEMES_FOR_UI`.
 */
import defaultTheme from "./default";
import royalEstate from "./royalEstate";
import emeraldResidence from "./emeraldResidence";
import oceanPrestige from "./oceanPrestige";
import modernMinimal from "./modernMinimal";
import luxuryBurgundy from "./luxuryBurgundy";
import desertVilla from "./desertVilla";
import platinum from "./platinum";

export const DEFAULT_THEME = defaultTheme;

/** Canonical default theme id (also the DB column default). */
export const DEFAULT_THEME_ID = "default";

/** Special id for a user-authored custom palette (settings stored in theme_settings). */
export const CUSTOM_THEME_ID = "custom";

/**
 * Ordered list of predefined theme definitions (drives the dashboard selector).
 * The default (Classic Luxury) is first; custom is appended separately by the UI.
 */
export const PREDEFINED_THEMES = Object.freeze([
  defaultTheme,
  royalEstate,
  emeraldResidence,
  oceanPrestige,
  modernMinimal,
  luxuryBurgundy,
  desertVilla,
  platinum,
]);

/** Quick id → definition lookup for predefined themes. */
const PREDEFINED_BY_ID = Object.fromEntries(
  PREDEFINED_THEMES.map((theme) => [theme.id, theme]),
);

/**
 * Get a predefined theme definition by id.
 * Returns `null` for unknown ids and for the custom id (custom has no static file).
 * @param {string} themeId
 */
export function getThemeDefinition(themeId) {
  if (!themeId || themeId === CUSTOM_THEME_ID) return null;
  return PREDEFINED_BY_ID[themeId] || null;
}

export { defaultTheme, royalEstate, emeraldResidence, oceanPrestige, modernMinimal, luxuryBurgundy, desertVilla, platinum };
