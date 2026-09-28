"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getFormatSet } from "@/lib/ads/formatSets";
import AdsDialog from "./AdsDialog";
import SizesPanel, { readImageFile, resolveSizes, sizeText } from "./SizesPanel";
import { formatPrice, fromLocalInput, toLocalInput } from "./adUi";
import styles from "./ads.module.css";

const EMPTY = {
  title: "",
  tier: "paid",
  headline: "",
  alt_text: "",
  cta_text: "",
  click_url: "",
  priority: "5",
  weight: "100",
  start_at: "",
  end_at: "",
  max_impressions: "",
  max_clicks: "",
  daily_impression_cap: "",
  viewer_cap_24h: "",
  advertiser_name: "",
  advertiser_contact: "",
  amount_paid: "",
  payment_ref: "",
  notes: "",
};

function toForm(ad) {
  if (!ad) return { ...EMPTY, start_at: toLocalInput(new Date().toISOString()) };
  const form = {};
  for (const key of Object.keys(EMPTY)) {
    const value = ad[key];
    form[key] = value === null || value === undefined ? "" : String(value);
  }
  form.start_at = toLocalInput(ad.start_at);
  form.end_at = toLocalInput(ad.end_at);
  return form;
}

function propertyFromAd(ad) {
  if (!ad?.property_id) return null;
  return {
    id: ad.property_id,
    title: ad.property_title,
    location: ad.property_location,
    price: ad.property_price,
    price_currency: ad.property_price_currency,
    is_public: ad.property_is_public && ad.agent_is_live,
    estate_name: ad.property_estate_name,
    agent_name: ad.property_agent_name,
    image_url: ad.property_image,
    url: ad.destination_url && !ad.click_url ? ad.destination_url : null,
  };
}

async function sendJson(url, method, body) {
  return send(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function send(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Request failed.");
    error.fields = data.fields || {};
    throw error;
  }
  return data;
}

export default function AdForm({ ad = null, initialError = "" }) {
  const router = useRouter();
  const isEdit = Boolean(ad);
  const [form, setForm] = useState(() => toForm(ad));
  const [property, setProperty] = useState(() => propertyFromAd(ad));
  const [formats, setFormats] = useState([]);
  const [sizeIds, setSizeIds] = useState(() => (ad?.creatives || []).map((c) => c.format_id));
  const [showCustomSizes, setShowCustomSizes] = useState(false);
  // A newly picked main image { file, preview, dims }, or null.
  const [newMain, setNewMain] = useState(null);
  const [removeMain, setRemoveMain] = useState(false);
  const [savedMainDims, setSavedMainDims] = useState(null);
  // Per-size changes: { [formatId]: { file, preview, dims, fit, dropCustom } }.
  const [sizeEdits, setSizeEdits] = useState({});
  // Every error is shown in a modal: { title, message, items?, action? }.
  const [dialog, setDialog] = useState(() =>
    initialError ? { title: "Ad saved as a draft (OFF)", message: initialError } : null,
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ad-formats")
      .then((res) => res.json())
      .then((data) => {
        const list = data.formats || [];
        setFormats(list);
        // New ads start with the banner set (desktop, tablet and mobile).
        if (!ad) {
          const codes = Object.values(getFormatSet("banner").screens);
          const ids = list.filter((f) => f.is_active && codes.includes(f.code)).map((f) => f.id);
          setSizeIds((current) => (current.length > 0 ? current : ids));
        }
      })
      .catch(() =>
        setDialog({
          title: "Couldn't load ad formats",
          message: "Refresh the page to try again.",
        }),
      );
  }, []);

  // Natural size of the saved main image, for the per-size shape warnings.
  useEffect(() => {
    if (!ad?.master_image_url) return;
    readImageUrl(ad.master_image_url).then(setSavedMainDims);
  }, [ad?.master_image_url]);

  // Free the preview URLs of picked files when they're replaced.
  useEffect(() => () => newMain && URL.revokeObjectURL(newMain.preview), [newMain]);

  const main = newMain
    ? { src: newMain.preview, dims: newMain.dims, isNew: true, removed: false }
    : ad?.master_image_url && !removeMain
      ? { src: ad.master_image_url, dims: savedMainDims, isNew: false, removed: false }
      : { src: null, dims: null, isNew: false, removed: Boolean(ad?.master_image_url && removeMain) };

  const isPaid = form.tier === "paid";
  const startMs = form.start_at ? new Date(form.start_at).getTime() : NaN;
  const endMs = form.end_at ? new Date(form.end_at).getTime() : null;
  const propertyUsable =
    Boolean(property) && property.is_public !== false && property.agent_is_live !== false;
  const hasPropertyPhoto = propertyUsable && Boolean(property.image_url);

  const sizeViews = useMemo(
    () =>
      resolveSizes({
        formats,
        sizeIds,
        creatives: ad?.creatives,
        sizeEdits,
        main,
        propertyPhoto: hasPropertyPhoto ? property.image_url : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formats, sizeIds, ad?.creatives, sizeEdits, main.src, main.dims, main.isNew, hasPropertyPhoto, property?.image_url],
  );
  const liveSizes = sizeViews.filter((view) => view.format.is_active);
  const missingSizes = liveSizes.filter((view) => view.kind === "missing");

  function editSize(formatId, patch) {
    if (patch.file) {
      readImageFile(patch.file).then((picked) =>
        setSizeEdits((current) => ({
          ...current,
          [formatId]: { ...current[formatId], ...patch, ...picked },
        })),
      );
      return;
    }
    setSizeEdits((current) => {
      const next = { ...current[formatId], ...patch };
      if (patch.file === null) Object.assign(next, { preview: null, dims: null });
      return { ...current, [formatId]: next };
    });
  }

  function changeSizes(ids) {
    setSizeIds(ids);
    setFieldErrors((current) => ({ ...current, format_ids: undefined }));
  }

  // Needed for any save (mirrors the server's validation).
  const saveChecks = [
    { key: "title", label: "Internal title", done: form.title.trim().length > 0 },
    { key: "format_ids", label: "At least one size", done: sizeIds.length > 0 },
    { key: "start_at", label: "Start date", done: Number.isFinite(startMs) },
    isPaid
      ? {
          key: "end_at",
          label: "End date after the start (paid ads)",
          done: endMs !== null && endMs > startMs,
        }
      : {
          key: "end_at",
          label: "End date after the start, if one is set",
          done: endMs === null || endMs > startMs,
        },
  ];

  // Needed before the ad can be ON (mirrors getActivationError on the server).
  const turnOnChecks = [
    {
      key: "image",
      label: "Every size has an image (main image, custom image, or a property with photos)",
      hint:
        missingSizes.length > 0
          ? `Missing: ${missingSizes.map((view) => sizeText(view.format)).join(", ")}.`
          : propertyUsable && !property.image_url
            ? "The linked property has no photos."
            : null,
      done: sizeIds.length > 0 && missingSizes.length === 0,
    },
    { key: "end_future", label: "End date is in the future", done: endMs === null || endMs > Date.now() },
    ...(property && !propertyUsable
      ? [{ key: "property_public", label: "Linked property is published and not hidden", done: false }]
      : []),
    ...(sizeViews.length > 0 && liveSizes.length === 0
      ? [{ key: "format_on", label: "At least one size is turned on (Ad Formats page)", done: false }]
      : []),
  ];

  const missing = (checks) =>
    checks.filter((check) => !check.done).map((check) => (check.hint ? `${check.label} — ${check.hint}` : check.label));

  // Checks the form before anything is sent, so a half-finished ad is never
  // saved by surprise. The server still re-validates everything.
  function trySubmit(activate) {
    const missingToSave = missing(saveChecks);
    if (missingToSave.length > 0) {
      setDialog({
        title: "Fill in the required fields",
        message: "These are needed before the ad can be saved:",
        items: missingToSave,
      });
      return;
    }

    const missingToTurnOn = missing(turnOnChecks);
    const isOn = ad?.status === "active";
    if (missingToTurnOn.length > 0 && activate) {
      setDialog({
        title: "This ad can't be turned ON yet",
        message: "Add these first — or save it OFF and finish later:",
        items: missingToTurnOn,
        action: {
          label: isEdit ? "Save without turning ON" : "Save as draft (OFF)",
          onClick: () => {
            setDialog(null);
            handleSubmit(false);
          },
        },
      });
      return;
    }
    if (missingToTurnOn.length > 0 && isOn) {
      setDialog({
        title: "Saving will turn this ad OFF",
        message: "The ad is ON, but with these changes it can't be shown:",
        items: missingToTurnOn,
        action: {
          label: "Save and turn OFF",
          onClick: () => {
            setDialog(null);
            handleSubmit(false, { turnOff: true });
          },
        },
      });
      return;
    }

    // An ON ad stays ON: it's switched back on after the new images are in.
    handleSubmit(activate || isOn);
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function setEndInDays(days) {
    const start = form.start_at ? new Date(form.start_at) : new Date();
    update("end_at", toLocalInput(new Date(start.getTime() + days * 86_400_000).toISOString()));
  }

  // Sends the main image and per-size changes after the ad itself is saved.
  // Returns the image warnings.
  async function saveImages(savedAd) {
    const base = `/api/admin/ads/${savedAd.id}`;
    const warnings = [];
    const saved = new Map(savedAd.creatives.map((creative) => [creative.format_id, creative]));
    const ids = [...saved.keys()];
    const editOf = (id) => sizeEdits[id] || {};
    const fitFor = (id) => editOf(id).fit || saved.get(id).fit || "cover";
    const mainAfter = Boolean(newMain) || (Boolean(savedAd.master_image_url) && !removeMain);

    if (removeMain && !newMain && savedAd.master_image_url) {
      await sendJson(`${base}/image`, "DELETE");
    }

    if (newMain) {
      const body = new FormData();
      body.append("image", newMain.file);
      body.append("fits", JSON.stringify(Object.fromEntries(ids.map((id) => [id, fitFor(id)]))));
      body.append("replace", JSON.stringify(ids.filter((id) => editOf(id).dropCustom)));
      const data = await send(`${base}/image`, { method: "POST", body }).catch((err) => {
        throw new Error(`Main image not saved: ${err.message}`);
      });
      warnings.push(...(data.warnings || []));
    } else if (mainAfter) {
      // Remake sizes whose fit changed, that have no image yet, or that
      // switch from a custom image back to the main one.
      for (const id of ids) {
        const creative = saved.get(id);
        const edit = editOf(id);
        if (edit.file) continue;
        if (creative.source === "upload" && !edit.dropCustom) continue;
        if (edit.dropCustom || !creative.image_url || fitFor(id) !== creative.fit) {
          const data = await sendJson(`${base}/sizes/${id}`, "PATCH", { fit: fitFor(id) });
          if (data.warning) warnings.push(data.warning);
        }
      }
    }

    for (const id of ids) {
      const edit = editOf(id);
      if (edit.file) {
        const body = new FormData();
        body.append("image", edit.file);
        body.append("fit", fitFor(id));
        const data = await send(`${base}/sizes/${id}`, { method: "POST", body }).catch((err) => {
          throw new Error(`Image for ${sizeText(saved.get(id))} not saved: ${err.message}`);
        });
        if (data.warning) warnings.push(data.warning);
      } else if (edit.dropCustom && !mainAfter && saved.get(id).source === "upload") {
        await sendJson(`${base}/sizes/${id}`, "DELETE");
      }
    }
    return warnings;
  }

  async function handleSubmit(activate, { turnOff = false } = {}) {
    setSaving(true);
    setDialog(null);
    setFieldErrors({});

    const payload = {
      ...form,
      format_ids: sizeIds,
      property_id: property?.id ?? null,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
    };
    if (form.tier === "free") {
      payload.amount_paid = "";
      payload.payment_ref = "";
    }

    let adId = ad?.id;
    let savedAd = null;
    let saveWarning = "";
    try {
      const saved = isEdit
        ? await sendJson(`/api/admin/ads/${adId}`, "PUT", payload)
        : await sendJson("/api/admin/ads", "POST", payload);
      savedAd = saved.ad;
      adId = savedAd.id;
      saveWarning = saved.warning || "";
    } catch (err) {
      const fields = err.fields || {};
      setFieldErrors(fields);
      setDialog({
        title: "Couldn't save the ad",
        message: err.message,
        items: [...new Set(Object.values(fields))].filter((text) => text !== err.message),
      });
      setSaving(false);
      return;
    }

    // The ad row exists now; any later failure sends the admin to its edit page.
    const wasOn = ad?.status === "active";
    let notice = "";
    try {
      if (turnOff && savedAd.status === "active") {
        await sendJson(`/api/admin/ads/${adId}/status`, "PATCH", { status: "paused" });
      }
      const warnings = await saveImages(savedAd);
      if (activate) {
        try {
          await sendJson(`/api/admin/ads/${adId}/status`, "PATCH", { status: "active" });
        } catch (err) {
          throw new Error(
            `Saved, but the ad ${wasOn ? "was turned OFF" : "could not be turned ON"}: ${err.message}`,
          );
        }
      } else if (saveWarning) {
        warnings.unshift(saveWarning);
      }
      notice = warnings.join(" ");
    } catch (err) {
      setSaving(false);
      if (isEdit) {
        setDialog({ title: "Saved, but something went wrong", message: err.message });
        router.refresh();
      } else {
        router.push(`/admin/dashboard/ads/${adId}/edit?error=${encodeURIComponent(err.message)}`);
      }
      return;
    }

    router.push(
      `/admin/dashboard/ads/${adId}${notice ? `?notice=${encodeURIComponent(notice)}` : ""}`,
    );
    router.refresh();
  }

  const fieldError = (key) =>
    fieldErrors[key] ? <p className={styles.fieldError}>{fieldErrors[key]}</p> : null;

  const defaultDestination = property?.url || "https://… or /some/page";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        trySubmit(false);
      }}
      noValidate
    >
      {dialog && (
        <AdsDialog
          {...dialog}
          onClose={() => {
            setDialog(null);
            // Drop ?error= so a refresh doesn't show the same message again.
            if (initialError && ad) router.replace(`/admin/dashboard/ads/${ad.id}/edit`);
          }}
        />
      )}

      {/* ------------------------------------------------ basics */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Ad type</h2>
        <p className={styles.cardHint}>Who pays decides the priority on the customer site.</p>

        <div className={styles.stack}>
          <div className={styles.tierChoice} role="radiogroup" aria-label="Tier">
            <TierOption
              value="paid"
              checked={form.tier === "paid"}
              onChange={() => update("tier", "paid")}
              title="Paid / Featured"
              text="Always shown before free ads. Needs an end date (flat fee per period)."
            />
            <TierOption
              value="free"
              checked={form.tier === "free"}
              onChange={() => update("tier", "free")}
              title="Free"
              text="House ads or free boosts. Shown only when no paid ad is live for that size."
            />
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="title">
                Internal title
                <Required />
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. DHA Phase 6 house — October feature"
              />
              <span className={styles.help}>Only admins see this.</span>
              {fieldError("title")}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ sizes */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Sizes &amp; images</h2>
        <p className={styles.cardHint}>
          One ad, every screen. Pick the sizes, upload one main image and each size is cropped
          from it automatically. Give any size its own design with a custom image.
        </p>
        <SizesPanel
          formats={formats}
          sizeIds={sizeIds}
          onSizeIdsChange={changeSizes}
          showCustom={showCustomSizes}
          onShowCustom={setShowCustomSizes}
          views={sizeViews}
          main={main}
          onMainFile={(file) => {
            readImageFile(file).then(setNewMain);
            setRemoveMain(false);
          }}
          onRemoveMain={() => {
            if (newMain) setNewMain(null);
            else setRemoveMain(true);
          }}
          onUndoRemoveMain={() => setRemoveMain(false)}
          onSizeEdit={editSize}
          error={fieldError("format_ids")}
        />
      </section>

      {/* ------------------------------------------------ content */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Content</h2>
        <p className={styles.cardHint}>
          The text and link are shared by every size. Linking a property also lets sizes
          without an image use the property&apos;s photo.
        </p>

        <div className={styles.stack}>
          <PropertyPicker value={property} onChange={setProperty} />
          {fieldError("property_id")}

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="headline">
                Headline <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="headline"
                value={form.headline}
                maxLength={120}
                onChange={(e) => update("headline", e.target.value)}
                placeholder={property?.title || "Shown on native/text layouts"}
              />
              {fieldError("headline")}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cta_text">
                Button text <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="cta_text"
                value={form.cta_text}
                maxLength={40}
                onChange={(e) => update("cta_text", e.target.value)}
                placeholder={property ? "View property" : "Learn more"}
              />
              {fieldError("cta_text")}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="alt_text">
                Image alt text <span className={styles.optional}>(accessibility)</span>
              </label>
              <input
                id="alt_text"
                value={form.alt_text}
                maxLength={255}
                onChange={(e) => update("alt_text", e.target.value)}
                placeholder="Describe the banner for screen readers"
              />
              {fieldError("alt_text")}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="click_url">
                Click destination <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="click_url"
                value={form.click_url}
                onChange={(e) => update("click_url", e.target.value)}
                placeholder={defaultDestination}
              />
              <span className={styles.help}>
                Leave empty to open the linked property. Site paths or https:// links only.
              </span>
              {fieldError("click_url")}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ schedule */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Schedule &amp; delivery</h2>
        <p className={styles.cardHint}>
          When the ad can appear, and how often it&apos;s picked. Paid always beats free; then
          the higher priority wins; ads with equal priority take turns by weight. Empty limits
          mean unlimited.
        </p>

        <div className={styles.stack}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="start_at">
                Starts
                <Required />
              </label>
              <input
                id="start_at"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => update("start_at", e.target.value)}
                aria-describedby="start_at-help"
              />
              <span id="start_at-help" className={styles.help}>
                Not shown before this time. A future date shows as Scheduled and goes live on its
                own.
              </span>
              {fieldError("start_at")}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="end_at">
                Ends
                {isPaid && <Required />}{" "}
                <span className={styles.optional}>
                  {isPaid ? "(required for paid ads)" : "(optional)"}
                </span>
              </label>
              <input
                id="end_at"
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => update("end_at", e.target.value)}
                aria-describedby="end_at-help"
              />
              <span id="end_at-help" className={styles.help}>
                {isPaid
                  ? "Stops showing after this time (Expired). Paid ads cover a fixed period."
                  : "Stops showing after this time (Expired). Leave empty to run with no end."}
              </span>
              <div className={styles.buttonRow} style={{ gap: 4 }}>
                {[7, 15, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={styles.buttonGhost}
                    onClick={() => setEndInDays(days)}
                  >
                    +{days} days
                  </button>
                ))}
              </div>
              {fieldError("end_at")}
            </div>
          </div>

          <div className={styles.grid2}>
            <NumberField
              id="priority"
              label="Priority (1–10)"
              value={form.priority}
              onChange={update}
              min={1}
              max={10}
              help="Within the same tier, the highest number always wins. Use 9–10 for the top spot."
              error={fieldError("priority")}
            />
            <NumberField
              id="weight"
              label="Rotation weight (1–1000)"
              value={form.weight}
              onChange={update}
              min={1}
              max={1000}
              help="Only between ads with the same priority: they take turns by weight (200 vs 100 ≈ 67% / 33%)."
              error={fieldError("weight")}
            />
          </div>

          <div className={styles.grid2}>
            <NumberField
              id="max_impressions"
              label="Max impressions"
              value={form.max_impressions}
              onChange={update}
              placeholder="Unlimited"
              help="Total views for the whole campaign. A view counts when the ad is half on screen for 1 second."
              error={fieldError("max_impressions")}
            />
            <NumberField
              id="max_clicks"
              label="Max clicks"
              value={form.max_clicks}
              onChange={update}
              placeholder="Unlimited"
              help="Total clicks for the whole campaign. The ad stops when this is reached."
              error={fieldError("max_clicks")}
            />
            <NumberField
              id="daily_impression_cap"
              label="Impressions / day"
              value={form.daily_impression_cap}
              onChange={update}
              placeholder="Unlimited"
              help="Spreads the campaign over days. Pauses for the rest of the day, resumes tomorrow (Pakistan time)."
              error={fieldError("daily_impression_cap")}
            />
            <NumberField
              id="viewer_cap_24h"
              label="Per visitor / 24h"
              value={form.viewer_cap_24h}
              onChange={update}
              placeholder="Unlimited"
              help="Max times one visitor sees this ad in 24 hours. After that they get the next ad."
              error={fieldError("viewer_cap_24h")}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ advertiser */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {form.tier === "paid" ? "Advertiser & payment" : "Advertiser"}
        </h2>
        <p className={styles.cardHint}>
          For your records only. Payments are handled manually — nothing here charges anyone.
        </p>

        <div className={styles.stack}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="advertiser_name">
                Advertiser <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="advertiser_name"
                value={form.advertiser_name}
                onChange={(e) => update("advertiser_name", e.target.value)}
                placeholder={property?.agent_name || "Agent, developer, bank…"}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="advertiser_contact">
                Contact <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="advertiser_contact"
                value={form.advertiser_contact}
                onChange={(e) => update("advertiser_contact", e.target.value)}
                placeholder="Phone or email"
              />
            </div>
            {form.tier === "paid" && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="amount_paid">
                    Amount paid (PKR) <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    id="amount_paid"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount_paid}
                    onChange={(e) => update("amount_paid", e.target.value)}
                  />
                  {fieldError("amount_paid")}
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="payment_ref">
                    Payment reference <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    id="payment_ref"
                    value={form.payment_ref}
                    onChange={(e) => update("payment_ref", e.target.value)}
                    placeholder="Receipt / transaction no."
                  />
                </div>
              </>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className={styles.card} aria-label="Checklist">
        <h2 className={styles.cardTitle}>Checklist</h2>
        <p className={styles.cardHint}>
          Fields marked <Required /> are required. Items tick themselves off as you fill the
          form.
        </p>
        <div className={styles.checklistGrid}>
          <Checklist heading="Required to save" checks={saveChecks} />
          <Checklist heading="Required to turn ON" checks={turnOnChecks} />
        </div>
      </section>

      <div className={styles.buttonRow} style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className={styles.buttonSecondary} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save as draft (OFF)"}
        </button>
        {ad?.status !== "active" && (
          <button
            type="button"
            className={styles.button}
            disabled={saving}
            onClick={() => trySubmit(true)}
          >
            {saving ? "Saving…" : "Save & turn ON"}
          </button>
        )}
      </div>
    </form>
  );
}

function readImageUrl(url) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function Required() {
  return (
    <span className={styles.required} aria-label="required" title="Required">
      *
    </span>
  );
}

function Checklist({ heading, checks }) {
  const doneCount = checks.filter((check) => check.done).length;
  return (
    <div>
      <p className={styles.checklistHeading}>
        {heading} · {doneCount}/{checks.length}
      </p>
      <ul className={styles.checklist}>
        {checks.map((check) => (
          <li
            key={check.key}
            className={`${styles.checkItem} ${check.done ? styles.checkDone : ""}`}
          >
            <span className={styles.checkIcon} aria-hidden="true">
              ✓
            </span>
            <span>
              {check.label}
              <span className="sr-only">{check.done ? " (done)" : " (not done)"}</span>
              {!check.done && check.hint && <span className={styles.checkHint}>{check.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TierOption({ value, checked, onChange, title, text }) {
  return (
    <label className={`${styles.tierOption} ${checked ? styles.tierOptionActive : ""}`}>
      <input
        type="radio"
        name="tier"
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={title}
      />
      <span>
        <span className={styles.tierOptionTitle}>{title}</span>
        <span className={styles.help} style={{ display: "block" }}>
          {text}
        </span>
      </span>
    </label>
  );
}

function NumberField({ id, label, value, onChange, min = 1, max, placeholder, help, error }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(id, e.target.value)}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help && (
        <span id={`${id}-help`} className={styles.help}>
          {help}
        </span>
      )}
      {error}
    </div>
  );
}

function PropertyPicker({ value, onChange }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/admin/properties/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => setResults(data.properties || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, open]);

  if (value && !open) {
    const inactive = !value.is_public;
    return (
      <div className={styles.field}>
        <span className={styles.label}>Linked property</span>
        <div className={styles.propertyCard}>
          {value.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.image_url} alt="" className={styles.thumb} />
          ) : (
            <div className={styles.thumb} />
          )}
          <div className={styles.propertyInfo}>
            <div className={styles.cellTitle}>
              #{value.id} · {value.title}
            </div>
            <div className={styles.cellSub}>
              {value.location || "No location"} · {formatPrice(value.price, value.price_currency)} ·{" "}
              {value.agent_name || value.estate_name}
            </div>
            {inactive && (
              <p className={styles.fieldError}>
                This property isn&apos;t published (or is hidden, or its agent isn&apos;t
                approved) — the ad won&apos;t serve.
              </p>
            )}
          </div>
          <div className={styles.buttonRow} style={{ gap: 4 }}>
            <button type="button" className={styles.buttonGhost} onClick={() => setOpen(true)}>
              Change
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              style={{ color: "var(--danger)" }}
              onClick={() => onChange(null)}
            >
              Unlink
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="property-search">
        Linked property <span className={styles.optional}>(optional)</span>
      </label>
      {open ? (
        <>
          <input
            id="property-search"
            type="search"
            value={term}
            autoFocus
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by title, location, estate, agent or ID"
          />
          <div className={styles.pickerResults}>
            {loading && results.length === 0 ? (
              <p className={styles.help} style={{ padding: 12 }}>
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className={styles.help} style={{ padding: 12 }}>
                No properties found.
              </p>
            ) : (
              results.map((item) => {
                const inactive = !item.is_public || !item.agent_is_live;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.pickerItem}
                    disabled={inactive}
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                      setTerm("");
                    }}
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" className={styles.thumb} />
                    ) : (
                      <span className={styles.thumb} />
                    )}
                    <span className={styles.propertyInfo}>
                      <span className={styles.cellTitle} style={{ display: "block" }}>
                        #{item.id} · {item.title}
                      </span>
                      <span className={styles.cellSub} style={{ display: "block" }}>
                        {item.location || "No location"} ·{" "}
                        {formatPrice(item.price, item.price_currency)} · {item.agent_name}
                        {item.unavailable_reason ? ` · ${item.unavailable_reason}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div>
            <button type="button" className={styles.buttonGhost} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div>
          <button type="button" className={styles.buttonSecondary} onClick={() => setOpen(true)}>
            Choose a property…
          </button>
        </div>
      )}
    </div>
  );
}
