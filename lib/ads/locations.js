// Where ads can show on the site. Admins assign each ad to one or more
// locations; every location shows its live ads as a carousel. Pure data,
// safe to import on the server and in the browser.
//
// To add a location: add it here, then put <AdSlot location="…" /> on the page.
import { formatCodes, getFormatSet } from "./formatSets.js";

// Every location uses the Billboard set: 970×250 desktop, 728×90 tablet,
// 320×100 mobile. All slides in a carousel need the same shape.
export const LOCATION_FORMATS = getFormatSet("billboard").screens;

export const AD_LOCATIONS = [
  { key: "home_above_hero", page: "Landing page", spot: "Above the hero" },
  { key: "home_below_hero", page: "Landing page", spot: "Below the hero" },
  { key: "agent_site_below_hero", page: "Agent public site", spot: "Below the hero" },
  { key: "agent_site_after_listings", page: "Agent public site", spot: "After the property listings" },
  { key: "property_below_hero", page: "Property detail page", spot: "Below the hero" },
  { key: "property_before_gallery", page: "Property detail page", spot: "Before the photo gallery" },
  { key: "agent_dashboard_top", page: "Agent dashboard", spot: "Top of every tab" },
];

export const LOCATION_KEYS = AD_LOCATIONS.map((location) => location.key);

// Pages in display order, each with its locations.
export const LOCATION_PAGES = [...new Set(AD_LOCATIONS.map((location) => location.page))].map(
  (page) => ({ page, locations: AD_LOCATIONS.filter((location) => location.page === page) }),
);

// A carousel shows at most this many ads, changing every SLIDE_MS.
export const MAX_SLIDES = 5;
export const SLIDE_MS = 4000;

export function getLocation(key) {
  return AD_LOCATIONS.find((location) => location.key === key) || null;
}

// "Landing page · Above the hero"; unknown keys (old placements) as-is.
export function locationLabel(key) {
  const location = getLocation(key);
  return location ? `${location.page} · ${location.spot}` : key;
}

// Format codes an ad needs for the given locations.
export function formatCodesForLocations(keys) {
  return keys.length > 0 ? formatCodes(LOCATION_FORMATS) : [];
}
