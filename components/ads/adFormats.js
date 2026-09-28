// Size sets used by the site's ad slots: desktop ≥1024px, tablet 768–1023px,
// mobile ≤767px. They come from lib/ads/formatSets.js, which the admin ad form
// also uses for its size presets. Change a set there to change every slot
// that uses it. Placement names and positions are listed in docs/ads-network.md.
import { getFormatSet } from "@/lib/ads/formatSets";

// Large banner at the very top of the home page.
export const BILLBOARD_FORMATS = getFormatSet("billboard").screens;

// Wide banner between page sections.
export const BANNER_FORMATS = getFormatSet("banner").screens;

// Listing-style card that sits inside a grid of cards.
export const GRID_CARD_FORMAT = getFormatSet("card").screens.desktop;
