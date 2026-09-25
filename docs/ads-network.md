# Ads Network

Super Admin creates ads at **/admin/dashboard/ads**; the customer site asks for an
ad by format and shows whatever comes back.

**Serving order:** Paid/Featured ad → Free ad → no ad.

## Setup

1. Run the migration on an existing database: `npm run migrate:ads-network`
   (SQL in `migrations/035_ads_network_up.sql`; roll back with `-- --down`).
   Fresh installs get the same tables from `schema.sql`.
2. Optional env vars in `.env`:
   - `ADS_SECRET` – signs ad tokens. Falls back to `NEXTAUTH_SECRET`.
   - `ADS_TZ_OFFSET_MINUTES` – day boundary for daily stats/caps. Default `300` (Pakistan).
3. Unit tests: `npm run test:ads`.

## For the frontend: showing an ad

### Option A — React hook (recommended)

```jsx
"use client";
import { useAd } from "@/lib/ads/client";

export default function TopBanner() {
  const { ad, loading, ref } = useAd("leaderboard_728x90", { placement: "home_top" });
  if (loading || !ad) return null; // no ad → render nothing

  return (
    <a ref={ref} href={ad.clickUrl ?? undefined}
       target={ad.opensNewTab ? "_blank" : undefined}
       rel={ad.isFeatured ? "sponsored noopener" : "noopener"}>
      {ad.label && <span>{ad.label}</span>}
      <img src={ad.imageUrl} alt={ad.altText}
           width={ad.format.width} height={ad.format.height} />
    </a>
  );
}
```

`ref` must be on the element that shows the ad — it counts the impression once the ad
is ≥50% visible for 1 second. Always link through `ad.clickUrl` so clicks are counted.

### Option B — plain functions

```js
import { fetchAd, observeImpression, trackImpression } from "@/lib/ads/client";

const ad = await fetchAd("rectangle_300x250", { placement: "property_sidebar", exclude: [12] });
const stop = observeImpression(element, ad); // or trackImpression(ad) to count immediately
```

### Option C — raw HTTP

```
GET /api/ads?format=<code>&placement=<name>&exclude=<id,id>
```

| Param | Required | Notes |
|---|---|---|
| `format` | yes | An ad format code from **Ad formats**, e.g. `leaderboard_728x90` |
| `placement` | no | Free label for reporting, e.g. `home_top`, `property_sidebar` (`a-z 0-9 _ -`) |
| `exclude` | no | Ad ids already on the page, so two slots never show the same ad |

Then `POST /api/ads/impression` with `{"token": ad.impressionToken}` when it's seen.

### Response

```json
{
  "ad": {
    "id": 5,
    "tier": "paid",
    "isFeatured": true,
    "label": "Featured",
    "format": { "code": "leaderboard_728x90", "type": "banner", "width": 728, "height": 90 },
    "creativeType": "image",
    "imageUrl": "/uploads/ads/5/abc.jpg",
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
    "impressionToken": "…"
  }
}
```

- `{ "ad": null }` → nothing eligible: hide the slot.
- `creativeType` is `"image"` for an uploaded banner (render it as-is) or `"property"` when
  `imageUrl` is the property's photo (render a card: photo + headline + price + CTA).
  `components/ads/AdSlot.js` does both.
- `property` is `null` for image-only ads. `clickUrl` is `null` if the ad has no destination.
- `label` is `"Featured"` for paid ads and `null` for free ones — free ads show no label.
  `AdSlot` shows it as a small badge in the image's top-left corner.
- `ctaText` is the admin's button text (property ads default to "View property"). `AdSlot`
  shows it as a button in the banner's bottom-right corner; the whole banner is the link.
- `imageUrl` may be at 2× the format size (for retina) — always render at `format.width/height`.
- Uploaded banners always have the format's exact shape: admins can upload any image and it is
  fitted automatically — "Crop to fill" (smart crop) or "Show whole image" (blurred edges fill
  the gaps). Images smaller than the format are enlarged, with a warning to the admin.
- Several slots on one page: pass the ids already shown in `exclude`.
- Load ads client-side. Server pages here are cached (e.g. the home page revalidates every
  60s), so a server-rendered ad would be frozen for everyone and wouldn't rotate.

### Slots already on the site

| Page | Placement | Desktop format | Phone format (≤768px) |
|---|---|---|---|
| `/` above the hero | `home_above_hero` | `billboard_970x250` | `mobile_banner_320x100` |
| `/` agents section, top | `home_agents_top` | `leaderboard_728x90` | `mobile_banner_320x100` |
| `/` agents grid (after the 3rd agent) | `home_agents_grid` | `native_card_400x300` | `native_card_400x300` |

An ad only appears in a slot that requests its format — e.g. a Billboard ad shows above the
hero on desktop, while phones need a Mobile banner ad.

### Seeded formats

| Code | Size | Type |
|---|---|---|
| `billboard_970x250` | 970×250 | banner |
| `leaderboard_728x90` | 728×90 | banner |
| `mobile_banner_320x100` | 320×100 | banner |
| `rectangle_300x250` | 300×250 | sidebar |
| `skyscraper_300x600` | 300×600 | sidebar |
| `native_card_400x300` | 400×300 | native |

Admins can add, edit, turn off or delete formats under **Ad Formats**. A format can only be
deleted while no ad (archived ones included) uses it; otherwise turn it off. Renaming a
format's code breaks frontend slots still requesting the old code. For responsive slots, request a different code
per breakpoint (e.g. `leaderboard_728x90` on desktop, `mobile_banner_320x100` on mobile).

## Rules the server applies

**Eligible** (all must hold): ad is ON (`active`), now is between start and end, format is ON,
linked property is published (`approved`, not hidden) and its agent is `approved` — the
same rules as the public listings — it has an image (uploaded or the
property's main photo), and no cap is reached (total impressions, total clicks, impressions
today, impressions for this visitor in the last 24h).

**Choosing one:**
1. Any eligible **paid** ad beats every free ad.
2. Within the tier, only the highest **priority** (1–10) competes.
3. Ties rotate by **weight** — weights 200 and 100 get ≈67% / 33% of requests.

**Statuses:** only `draft`, `active` (ON), `paused` (OFF) and `archived` are stored. The admin
list also shows derived states — Scheduled, Live, Expired, Cap reached, Daily cap reached and
Blocked (with the reason) — so no cron job is needed.

**Tracking:** each served ad has a signed token. An impression/click counts once per token;
tokens can't be forged or replayed, bot user-agents are ignored, and clicks redirect to the
URL stored in the database (never one from the query string). Visitors are identified only
by a random `ad_vid` cookie, stored hashed.

**Demo reseed:** `npm run seed` truncates `properties`, so ads linked to properties will point
at whichever new listing reuses that id. Re-link or archive property ads after reseeding.

**Payments** are not processed. Paid ads need an end date; amount and payment reference are
optional notes for the admin.
