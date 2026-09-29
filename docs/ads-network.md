# Ads Network

Super Admin creates ads at **/admin/dashboard/ads** and picks the **locations** where each
ad shows. Every location on the site shows its live ads as a **carousel**.

**Carousel order:** paid/featured ads first (highest priority first), then free ads — up to
5 slides, changing every 6 seconds. A location with one ad shows a plain banner; with none,
nothing.

**One ad, several sizes.** Every location uses the Billboard set: 970×250 on desktop, 728×90
on tablets, 320×100 on phones. The admin uploads one **main image** and every size is
cropped from it automatically; any size can get its own **custom image** instead. All sizes
share the ad's schedule, priority, caps, text, link and stats.

## Setup

1. Run the migrations on an existing database, in order:
   - `npm run migrate:ads-network` (SQL in `migrations/035_ads_network_up.sql`)
   - `npm run migrate:ad-variants` (multi-size ads). Each existing ad becomes an ad with one
     size, keeping its image and stats.
   - `npm run migrate:ad-locations` (ad locations). Existing ads are assigned to every
     location, so nothing live disappears; narrow them down in the ad form.

   Roll back with `-- --down`, newest first. Fresh installs get the same tables from
   `schema.sql`.
2. Optional env vars in `.env`:
   - `ADS_SECRET` – signs ad tokens. Falls back to `NEXTAUTH_SECRET`.
   - `ADS_TZ_OFFSET_MINUTES` – day boundary for daily stats/caps. Default `300` (Pakistan).
3. Unit tests: `npm run test:ads`.

## Locations

Defined in `lib/ads/locations.js` (shared by the admin form, the API and the slots).

| Page | Location key | Where |
|---|---|---|
| Landing page `/` | `home_above_hero` | Between the search bar and the hero |
| Landing page `/` | `home_below_hero` | Right after the hero, before the agents section |
| Agent public site `/re/[handle]` | `agent_site_below_hero` | Right after the hero slider, before the brand profile |
| Agent public site `/re/[handle]` | `agent_site_after_listings` | After the property listings, before the trust stats |
| Property page `/re/[handle]/[property]` | `property_below_hero` | Right after the hero gallery, before the highlights |
| Property page `/re/[handle]/[property]` | `property_before_gallery` | After the details + contact card, before "Explore every space" |
| Agent dashboard `/re/[handle]/dashboard/*` | `agent_dashboard_top` | Top of every tab, below the header |

No ads anywhere else (blog, video, files-updates, become-an-agent and privacy pages, super
admin pages, login pages). Each location shows up in the ad's "By location" stats.

**Adding a location:** add it to `AD_LOCATIONS` in `lib/ads/locations.js` and to the
`LOCATION_KEYS` list in `scripts/migrate-ad-locations.js` (used for the backfill), then place
`<AdSlot location="your_key" />` on the page. It appears in the admin dropdown automatically.

## For the frontend: showing ads

### Option A — `<AdSlot>` (easiest)

```jsx
import AdSlot from "@/components/ads/AdSlot";

<AdSlot location="property_before_gallery" spacing="section" />
```

It picks the size for the screen, shows the location's ads as a carousel (auto-advance
every 6s, arrows, dots, swipe, pause button; pauses on hover, focus, hidden tab or when
off screen; no auto-advance with reduced motion), swaps size on resize and renders nothing
when there's no ad. `spacing="section"` adds room above and below.

### Option B — React hooks

```jsx
"use client";
import { useAds, useImpression } from "@/lib/ads/client";

function Slide({ ad }) {
  const ref = useImpression(ad); // counts once it's ≥50% visible for 1s
  return (
    <a ref={ref} href={ad.clickUrl ?? undefined}
       rel={ad.isFeatured ? "sponsored noopener" : "noopener"}>
      <img src={ad.imageUrl} alt={ad.altText} width={ad.format.width} height={ad.format.height} />
    </a>
  );
}

export default function MyCarousel() {
  const { ads } = useAds("home_above_hero", "billboard_970x250", {
    also: ["leaderboard_728x90", "mobile_banner_320x100"], // sizes it may switch to
  });
  return ads.map((ad) => <Slide key={ad.id} ad={ad} />);
}
```

When the format changes (e.g. on resize) and every served ad has that size too, `useAds`
swaps them in place; otherwise it fetches again. Always link through `ad.clickUrl` so clicks
are counted.

### Option C — raw HTTP

```
GET /api/ads?location=<key>&format=<code>&also=<code,code>
```

| Param | Required | Notes |
|---|---|---|
| `location` | yes | A location key from the table above |
| `format` | yes | The size for the current screen, e.g. `billboard_970x250`. Only ads that have this size show. |
| `also` | no | Other sizes the slot may switch to (up to 5). Each ad's matching sizes come back in `variants`. |

Then `POST /api/ads/impression` with `{"token": ad.impressionToken}` for each slide that's seen.

The older single-ad form, `GET /api/ads?format=<code>&placement=<name>&exclude=<id,id>`
(no `location`), still returns `{ "ad": … }`: the one best ad of that size from any location.

### Response

```json
{
  "ads": [
    {
      "id": 5,
      "tier": "paid",
      "isFeatured": true,
      "label": "Featured",
      "format": { "code": "billboard_970x250", "type": "banner", "width": 970, "height": 250 },
      "creativeType": "image",
      "imageUrl": "/uploads/ads/5/billboard_970x250-abc.jpg",
      "headline": "10 Marla Luxury House in DHA Phase 6",
      "altText": "…",
      "ctaText": "View property",
      "property": {
        "id": 12, "title": "…", "price": 42500000, "location": "DHA Phase 6 Lahore",
        "priceCurrency": "PKR", "size": "10 marla", "estateName": "dha-homes", "agentName": "…",
        "url": "/re/dha-homes/10-marla-luxury-house-in-dha-phase-6-12"
      },
      "clickUrl": "/api/ads/click?t=…",
      "opensNewTab": false,
      "impressionToken": "…",
      "variants": [
        { "format": { "code": "billboard_970x250", "…": "…" }, "imageUrl": "…", "clickUrl": "…", "impressionToken": "…" },
        { "format": { "code": "leaderboard_728x90", "…": "…" }, "imageUrl": "…", "clickUrl": "…", "impressionToken": "…" },
        { "format": { "code": "mobile_banner_320x100", "…": "…" }, "imageUrl": "…", "clickUrl": "…", "impressionToken": "…" }
      ]
    }
  ],
  "ad": { "…": "the first slide, for older clients" }
}
```

- `ads: []` → nothing to show: hide the slot.
- `creativeType` is `"image"` for an uploaded banner (render it as-is) or `"property"` when
  `imageUrl` is the property's photo (render photo + headline + price + CTA).
  `components/ads/AdSlot.js` does both.
- `property` is `null` for image-only ads. `clickUrl` is `null` if the ad has no destination.
- `label` is `"Featured"` for paid ads and `null` for free ones — free ads show no label.
  `AdSlot` shows it as a small badge in the image's top-left corner.
- `ctaText` is the admin's button text (property ads default to "View property"). `AdSlot`
  shows it as a button in the banner's bottom-right corner; the whole banner is the link.
- `variants` holds each ad in every requested size it has (`format` + `also`). To switch
  size, merge a variant over the ad (`adForFormat(ad, code)` in `lib/ads/client.js`). The
  sizes of one ad share a token id, so a slide that switches size still counts once; stats
  record which size was on screen.
- `imageUrl` may be at 2× the format size (for retina) — always render at `format.width/height`.
- Load ads client-side. Server pages here are cached (e.g. the home page revalidates every
  60s), so a server-rendered ad would be frozen for everyone and wouldn't rotate.

### Screen sizes

| Desktop ≥1024px | Tablet 768–1023px | Mobile ≤767px |
|---|---|---|
| 970×250 | 728×90 | 320×100 |

The slot waits until it knows the screen width, then requests that screen's size. Only ads
that have that size show, so an ad never appears stretched. On resize or rotation the
slides switch to their other size with no new request and no second impression. The sizes
come from `LOCATION_FORMATS` in `lib/ads/locations.js` (the Billboard set in
`lib/ads/formatSets.js`).

### Formats

| Code | Size | Type |
|---|---|---|
| `billboard_970x250` | 970×250 | banner |
| `leaderboard_728x90` | 728×90 | banner |
| `mobile_banner_320x100` | 320×100 | banner |
| `rectangle_300x250` | 300×250 | sidebar |
| `skyscraper_300x600` | 300×600 | sidebar |
| `native_card_400x300` | 400×300 | native |

The first three are used by every location, so they can't be deleted or have their code
changed (turning one off hides that size everywhere). Other formats can be added, edited,
turned off or deleted under **Ad Formats**; a format can only be deleted while no ad
(archived ones included) uses it.

## Admin: creating an ad

1. **Ad type** — Paid/Featured or Free, plus an internal title.
2. **Location** (required) — a dropdown of the locations, grouped by page, with "Select
   page" / "Select all". The chosen locations show as chips. The ad's sizes follow from its
   locations.
3. **Sizes & images** — shows the sizes the locations need. Upload one **main image**;
   every size is cropped from it on save (replacing it remakes every size except custom
   ones). Each size has a preview, "Crop to fill" / "Show whole image", and **Upload custom
   image** for a hand-made design; "Use main image instead" goes back to the automatic crop.
   Images can be dropped onto the tiles. The form warns when a size is a very different
   shape from the image, or when the image is too small for it.
4. **Content**, **Schedule & delivery**, **Advertiser & payment**, then the checklist.

Sizes without an image use the linked property's photo (the site builds a banner from it).
The ad can only be turned ON when it has a location and **every size has an image** (main,
custom or property photo). The ads list shows each ad's locations and filters by location;
the ad page shows its locations and stats **by location** and **by size**.

Admin endpoints: `POST|PUT /api/admin/ads[/id]` take `locations` (array of keys); sizes are
derived on the server. Images: `POST|DELETE /api/admin/ads/[id]/image` (main image; POST
takes `image`, optional `fits` and `replace`), and `POST|PATCH|DELETE
/api/admin/ads/[id]/sizes/[formatId]` (custom image, remake from the main image with a
`fit`, remove).

## Rules the server applies

**Eligible** (all must hold): ad is ON (`active`), now is between start and end, it's
assigned to the location, it has the requested size and that format is ON, linked property
is published (`approved`, not hidden) and its agent is `approved` — the same rules as the
public listings — every size that's turned on has an image (its own or the property's main
photo), and no cap is reached (total impressions, total clicks, impressions today,
impressions for this visitor in the last 24h). Caps count all sizes and locations together.

**Carousel order** (`orderForCarousel` in `lib/ads/pick.js`):
1. Every eligible **paid** ad comes before any free ad.
2. Within a tier, higher **priority** (1–10) comes first.
3. Equal priorities are shuffled by **weight** on each page view — weights 200 and 100 lead
   ≈67% / 33% of the time.
4. At most 5 slides.

**Statuses:** only `draft`, `active` (ON), `paused` (OFF) and `archived` are stored. The admin
list also shows derived states — Scheduled, Live, Expired, Cap reached, Daily cap reached and
Blocked (with the reason) — so no cron job is needed.

**Tracking:** every slide has its own signed token (one token id shared by the ad's sizes,
each naming the size shown). A slide's impression counts once it has been ≥50% visible for
1 second — slides hidden in the carousel don't count until they're shown — and at most once
per token id. Tokens can't be forged or replayed, bot user-agents are ignored, and clicks
redirect to the URL stored in the database (never one from the query string). Visitors are
identified only by a random `ad_vid` cookie, stored hashed.

**Demo reseed:** `npm run seed` truncates `properties`, so ads linked to properties will point
at whichever new listing reuses that id. Re-link or archive property ads after reseeding.

**Payments** are not processed. Paid ads need an end date; amount and payment reference are
optional notes for the admin.
