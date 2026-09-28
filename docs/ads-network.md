# Ads Network

Super Admin creates ads at **/admin/dashboard/ads**; the customer site asks for an
ad by format and shows whatever comes back.

**Serving order:** Paid/Featured ad → Free ad → no ad.

**One ad, several sizes.** An ad has one or more sizes (e.g. 970×250 for desktop, 728×90 for
tablets, 320×100 for phones). All sizes share the ad's schedule, priority, caps, text, link
and stats. The admin uploads one **main image** and every size is cropped from it
automatically; any size can get its own **custom image** instead.

## Setup

1. Run the migrations on an existing database, in order:
   - `npm run migrate:ads-network` (SQL in `migrations/035_ads_network_up.sql`)
   - `npm run migrate:ad-variants` (multi-size ads: `scripts/migrate-ad-variants.js`). Each
     existing ad becomes an ad with one size, keeping its image and stats.

   Roll back with `-- --down` (ad-variants first). Fresh installs get the same tables from
   `schema.sql`.
2. Optional env vars in `.env`:
   - `ADS_SECRET` – signs ad tokens. Falls back to `NEXTAUTH_SECRET`.
   - `ADS_TZ_OFFSET_MINUTES` – day boundary for daily stats/caps. Default `300` (Pakistan).
3. Unit tests: `npm run test:ads`.

## For the frontend: showing an ad

### Option A — `<AdSlot>` (easiest)

```jsx
import AdSlot from "@/components/ads/AdSlot";
import { BANNER_FORMATS } from "@/components/ads/adFormats";

<AdSlot placement="blog_post" formats={BANNER_FORMATS} spacing="section" />
```

It picks the size for the screen, swaps size on resize and renders nothing when there's no
ad. See "Screen sizes" below.

### Option B — React hook

```jsx
"use client";
import { useAd } from "@/lib/ads/client";

export default function TopBanner() {
  const { ad, loading, ref } = useAd("leaderboard_728x90", {
    placement: "home_top",
    also: ["mobile_banner_320x100"], // other sizes this slot may switch to
  });
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
When you change the format (e.g. on resize) and the served ad has that size too, the hook
swaps to it without a new request; otherwise it fetches a new ad.

### Option C — plain functions

```js
import { fetchAd, observeImpression, trackImpression } from "@/lib/ads/client";

const ad = await fetchAd("rectangle_300x250", { placement: "property_sidebar", exclude: [12] });
const stop = observeImpression(element, ad); // or trackImpression(ad) to count immediately
```

### Option D — raw HTTP

```
GET /api/ads?format=<code>&also=<code,code>&placement=<name>&exclude=<id,id>
```

| Param | Required | Notes |
|---|---|---|
| `format` | yes | The size for the current screen, e.g. `leaderboard_728x90`. Only ads that have this size compete. |
| `also` | no | Other sizes the slot may switch to (up to 5). The winning ad's matching sizes come back in `variants`. |
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
    "impressionToken": "…",
    "variants": [
      { "format": { "code": "leaderboard_728x90", "…": "…" }, "creativeType": "image",
        "imageUrl": "/uploads/ads/5/leaderboard_728x90-abc.jpg", "clickUrl": "…", "impressionToken": "…" },
      { "format": { "code": "mobile_banner_320x100", "…": "…" }, "creativeType": "image",
        "imageUrl": "/uploads/ads/5/mobile_banner_320x100-def.jpg", "clickUrl": "…", "impressionToken": "…" }
    ]
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
- `variants` holds this ad in each requested size it has (`format` + `also`), including the
  current one. To switch size, merge a variant over the ad (`adForFormat(ad, code)` in
  `lib/ads/client.js`). The variants share one token id, so a view that switches size still
  counts one impression; stats record which size was on screen.
- `imageUrl` may be at 2× the format size (for retina) — always render at `format.width/height`.
- Every size's image has that size's exact shape: admins upload any image and it is fitted
  automatically, per size — "Crop to fill" (smart crop) or "Show whole image" (blurred edges
  fill the gaps). Images smaller than the size are enlarged, with a warning to the admin.
- Several slots on one page: pass the ids already shown in `exclude`.
- Load ads client-side. Server pages here are cached (e.g. the home page revalidates every
  60s), so a server-rendered ad would be frozen for everyone and wouldn't rotate.

### Screen sizes

| Size set | Desktop ≥1024px | Tablet 768–1023px | Mobile ≤767px |
|---|---|---|---|
| Billboard set (`BILLBOARD_FORMATS`) | 970×250 | 728×90 | 320×100 |
| Banner set (`BANNER_FORMATS`) | 728×90 | 728×90 | 320×100 |
| Listing card (`GRID_CARD_FORMAT`) | 400×300 | 400×300 | 400×300 |

The sets live in `lib/ads/formatSets.js`, which both the slots (`components/ads/adFormats.js`)
and the admin ad form's size presets use, so admins create exactly the sizes slots ask for.

- The slot waits until it knows the screen width, then requests that screen's size (plus the
  set's other sizes in `also`).
- Only ads that have that size compete. A desktop-only ad never shows stretched on a phone;
  the phone gets the next eligible ad (or a free ad) instead.
- On resize or rotation the slot switches the same ad to its other size with no new request
  and no second impression. If the ad doesn't have the new size, the slot fetches again.
- A `formats` object without `tablet` uses the desktop size on tablets.

### Slots already on the site

| Page | Placement | Where | Formats |
|---|---|---|---|
| `/` | `home_above_hero` | Between the search bar and the hero | Billboard set |
| `/` | `home_agents_top` | Top of the agents section | Leaderboard / Mobile banner |
| `/` | `home_agents_grid` | Card in the agents grid, after the 3rd agent | Native card |
| `/re/[handle]` (agent site) | `agent_site` | After the listings, before the trust stats | Leaderboard / Mobile banner |
| `/re/[handle]/[property]` | `property_detail` | After the details + contact card, before the gallery | Leaderboard / Mobile banner |
| `/re/[handle]/blogs/[slug]` | `blog_post` | After the post, before the contact section | Leaderboard / Mobile banner |
| `/re/[handle]/videos/[slug]` | `video_post` | After the video, before the contact section | Leaderboard / Mobile banner |
| `/re/[handle]/files-updates` | `files_updates` | After the updates, before the contact section | Leaderboard / Mobile banner |
| `/become-an-agent` | `become_agent` | Before the closing call-to-action | Leaderboard / Mobile banner |
| `/privacy-policy` | `privacy_policy` | End of the policy | Leaderboard / Mobile banner |
| `/re/[handle]/dashboard/*` (agent portal) | `agent_dashboard` | Bottom of every dashboard page | Leaderboard / Mobile banner |

No ads on: super admin pages, login / signup / password pages, and the legacy
`/agent/dashboard` fallback. Each placement name shows up in the ad's "By placement" stats.

"Leaderboard / Mobile banner" is the banner set (728×90 on desktop and tablet, 320×100 on
phones). An ad only appears in a slot on screens it has a size for — pick the matching set
in the ad form so it shows on every screen.

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
deleted while no ad (archived ones included) uses it as a size; otherwise turn it off.
Turning a format off hides just that size: ads with other sizes keep serving. Renaming a
format's code breaks frontend slots still requesting the old code (and the size sets in
`lib/ads/formatSets.js`).

## Admin: sizes and images

In the ad form under **Sizes & images**:

1. **Where it runs** — pick a size set (Billboard set, Banner set, Listing card) or
   **Custom sizes** for any combination. New ads start with the Banner set.
2. **Main image** — upload one large image; every size is cropped from it on save. Replacing
   it remakes every size except those with a custom image.
3. **Per size** — each size has a preview, "Crop to fill" / "Show whole image", and
   **Upload custom image** for a hand-made design (e.g. bigger text on mobile). "Use main
   image instead" goes back to the automatic crop. The form warns when a size is a very
   different shape from the image, or when the image is too small for it.

Sizes without an image use the linked property's photo (the site builds a banner from it).
The ad can only be turned ON when **every size that's turned on has an image** (main, custom
or property photo). Adding a size to a live ad makes it from the main image right away;
removing a size deletes its image. The ad's detail page shows impressions, clicks and CTR
**by size**.

Admin image endpoints: `POST|DELETE /api/admin/ads/[id]/image` (main image; POST takes
`image`, optional `fits` and `replace`), and `POST|PATCH|DELETE
/api/admin/ads/[id]/sizes/[formatId]` (custom image, remake from the main image with a
`fit`, remove).

## Rules the server applies

**Eligible** (all must hold): ad is ON (`active`), now is between start and end, the ad has
the requested size and that format is ON, linked property is published (`approved`, not
hidden) and its agent is `approved` — the same rules as the public listings — every size
that's turned on has an image (its own or the property's main photo), and no cap is reached
(total impressions, total clicks, impressions today, impressions for this visitor in the
last 24h). Caps count all sizes together.

**Choosing one:**
1. Any eligible **paid** ad beats every free ad.
2. Within the tier, only the highest **priority** (1–10) competes.
3. Ties rotate by **weight** — weights 200 and 100 get ≈67% / 33% of requests.

**Statuses:** only `draft`, `active` (ON), `paused` (OFF) and `archived` are stored. The admin
list also shows derived states — Scheduled, Live, Expired, Cap reached, Daily cap reached and
Blocked (with the reason) — so no cron job is needed.

**Tracking:** each served ad has a signed token (one token id shared by its sizes, each
naming the size shown). An impression/click counts once per token id;
tokens can't be forged or replayed, bot user-agents are ignored, and clicks redirect to the
URL stored in the database (never one from the query string). Visitors are identified only
by a random `ad_vid` cookie, stored hashed.

**Demo reseed:** `npm run seed` truncates `properties`, so ads linked to properties will point
at whichever new listing reuses that id. Re-link or archive property ads after reseeding.

**Payments** are not processed. Paid ads need an end date; amount and payment reference are
optional notes for the admin.
