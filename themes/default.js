/**
 * Classic Luxury — the DEFAULT agent public website theme.
 *
 * Palette values mirror `app/agent-public-theme.css` exactly so that existing
 * agents (theme_id = "default") render pixel-identical to the pre-theme website.
 * The theme engine only applies overrides for non-default themes; the default
 * theme resolves to `null` (no inline override) so the CSS defaults apply as-is.
 */
export default {
  id: "default",
  name: "Classic Luxury",
  description: "Black, champagne gold and white — the signature look.",
  palette: {
    primary: "#111111",
    secondary: "#ffffff",
    accent: "#c8a45d",
    accentSecondary: "#8a6a2f",
    accentSoft: "#d4b574",
    accentTint: "#f5efe3",
    background: "#fafaf8",
    surface: "#ffffff",
    text: "#111111",
    textSoft: "#666666",
    mutedText: "#999999",
    border: "#e7e2d6",
    buttonPrimary: "#111111",
    buttonSecondary: "#c8a45d",
  },
};
