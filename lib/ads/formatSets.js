// Size sets: which ad size a slot shows at each screen width. Shared by the
// customer-side slots (components/ads/adFormats.js) and the admin ad form's
// size presets, so admins create exactly the sizes the site asks for.
// Pure data + helpers, safe to import on the server and in the browser.

// Screen widths in CSS px: mobile ≤ 767, tablet 768–1023, desktop ≥ 1024.
export const SCREEN_BREAKPOINTS = { mobileMax: 767, tabletMax: 1023 };

export const SCREENS = ["desktop", "tablet", "mobile"];

export const FORMAT_SETS = [
  {
    key: "billboard",
    name: "Billboard set",
    hint: "Top of the home page",
    screens: {
      desktop: "billboard_970x250",
      tablet: "leaderboard_728x90",
      mobile: "mobile_banner_320x100",
    },
  },
  {
    key: "banner",
    name: "Banner set",
    hint: "Between page sections",
    screens: {
      desktop: "leaderboard_728x90",
      tablet: "leaderboard_728x90",
      mobile: "mobile_banner_320x100",
    },
  },
  {
    key: "card",
    name: "Listing card",
    hint: "Inside the agents grid",
    screens: {
      desktop: "native_card_400x300",
      tablet: "native_card_400x300",
      mobile: "native_card_400x300",
    },
  },
];

export function getFormatSet(key) {
  return FORMAT_SETS.find((set) => set.key === key) || null;
}

// Distinct format codes a set (or a slot's `formats` prop) uses.
export function formatCodes(formats) {
  if (!formats) return [];
  if (typeof formats === "string") return [formats];
  const screens = formats.screens || formats;
  return [...new Set(SCREENS.map((screen) => screens[screen]).filter(Boolean))];
}

export function screenForWidth(width, breakpoints = SCREEN_BREAKPOINTS) {
  if (width <= breakpoints.mobileMax) return "mobile";
  if (width <= breakpoints.tabletMax) return "tablet";
  return "desktop";
}

// The format code a slot requests on a screen. A missing tablet size falls
// back to desktop; a missing mobile size falls back to tablet, then desktop.
export function formatForScreen(formats, screen) {
  if (!formats) return null;
  if (typeof formats === "string") return formats;
  const { desktop, tablet, mobile } = formats.screens || formats;
  if (screen === "mobile") return mobile || tablet || desktop || null;
  if (screen === "tablet") return tablet || desktop || null;
  return desktop || tablet || mobile || null;
}

// Which screens a format code is used on across all sets, e.g.
// leaderboard_728x90 → ["desktop", "tablet"]. Used for admin labels.
export function screensForFormat(code) {
  const screens = new Set();
  for (const set of FORMAT_SETS) {
    for (const screen of SCREENS) {
      if (set.screens[screen] === code) screens.add(screen);
    }
  }
  return SCREENS.filter((screen) => screens.has(screen));
}
