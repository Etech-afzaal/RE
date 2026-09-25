"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdsDialog from "./AdsDialog";
import { formatPrice, fromLocalInput, toLocalInput } from "./adUi";
import styles from "./ads.module.css";

const EMPTY = {
  title: "",
  tier: "paid",
  format_id: "",
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
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
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
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileSize, setFileSize] = useState(null); // natural { width, height } of the picked file
  const [fit, setFit] = useState("cover"); // how the server fits it: "cover" | "contain"
  const [removeImage, setRemoveImage] = useState(false);
  // Every error is shown in a modal: { title, message, items?, action? }.
  const [dialog, setDialog] = useState(() =>
    initialError ? { title: "Ad saved as a draft (OFF)", message: initialError } : null,
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ad-formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats || []))
      .catch(() =>
        setDialog({
          title: "Couldn't load ad formats",
          message: "Refresh the page to try again.",
        }),
      );
  }, []);

  const format = useMemo(
    () => formats.find((item) => String(item.id) === String(form.format_id)) || null,
    [formats, form.format_id],
  );

  const currentImage = removeImage ? null : ad?.image_url || null;
  const lockFormat = Boolean(ad?.image_url && !removeImage);

  // Read the picked file's size so the form can explain how it will be fitted.
  // Any image is accepted — the server resizes it to the format (see image route).
  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      setFileSize(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    const img = new window.Image();
    img.onload = () => setFileSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fitInfo = useMemo(() => {
    if (!fileSize || !format) return null;
    const ratioOff =
      Math.abs(fileSize.width / fileSize.height - format.width / format.height) /
      (format.width / format.height);
    const shapeMatches = ratioOff <= 0.02;
    const enlarged =
      fit === "contain" && !shapeMatches
        ? fileSize.width < format.width && fileSize.height < format.height
        : fileSize.width < format.width || fileSize.height < format.height;
    return { shapeMatches, enlarged };
  }, [fileSize, format, fit]);

  const isPaid = form.tier === "paid";
  const startMs = form.start_at ? new Date(form.start_at).getTime() : NaN;
  const endMs = form.end_at ? new Date(form.end_at).getTime() : null;
  const propertyUsable =
    Boolean(property) && property.is_public !== false && property.agent_is_live !== false;
  const hasBanner = Boolean(file) || Boolean(currentImage);
  const hasPropertyPhoto = propertyUsable && Boolean(property.image_url);

  // Needed for any save (mirrors the server's validation).
  const saveChecks = [
    { key: "title", label: "Internal title", done: form.title.trim().length > 0 },
    { key: "format_id", label: "Format & size", done: Boolean(form.format_id) },
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
      label: "An image: upload a banner, or link a property that has photos",
      hint: propertyUsable && !property.image_url ? "The linked property has no photos." : null,
      done: hasBanner || hasPropertyPhoto,
    },
    { key: "end_future", label: "End date is in the future", done: endMs === null || endMs > Date.now() },
    ...(property && !propertyUsable
      ? [{ key: "property_public", label: "Linked property is published and not hidden", done: false }]
      : []),
    ...(format && !format.is_active
      ? [{ key: "format_on", label: "Selected format is turned on (Ad Formats page)", done: false }]
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
    if (missingToTurnOn.length > 0 && ad?.status === "active") {
      setDialog({
        title: "Saving will turn this ad OFF",
        message: "The ad is ON, but with these changes it can't be shown:",
        items: missingToTurnOn,
        action: {
          label: "Save and turn OFF",
          onClick: () => {
            setDialog(null);
            handleSubmit(false);
          },
        },
      });
      return;
    }

    handleSubmit(activate);
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function setEndInDays(days) {
    const start = form.start_at ? new Date(form.start_at) : new Date();
    update("end_at", toLocalInput(new Date(start.getTime() + days * 86_400_000).toISOString()));
  }

  async function handleSubmit(activate) {
    setSaving(true);
    setDialog(null);
    setFieldErrors({});

    const payload = {
      ...form,
      property_id: property?.id ?? null,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
    };
    if (form.tier === "free") {
      payload.amount_paid = "";
      payload.payment_ref = "";
    }

    let adId = ad?.id;
    let notice = "";
    try {
      const saved = isEdit
        ? await sendJson(`/api/admin/ads/${adId}`, "PUT", payload)
        : await sendJson("/api/admin/ads", "POST", payload);
      adId = saved.ad.id;
      notice = saved.warning || "";
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
    try {
      if (removeImage && ad?.image_url && !file) {
        await sendJson(`/api/admin/ads/${adId}/image`, "DELETE");
      }
      if (file) {
        const body = new FormData();
        body.append("image", file);
        body.append("fit", fitInfo?.shapeMatches ? "cover" : fit);
        const res = await fetch(`/api/admin/ads/${adId}/image`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Image not saved: ${data.error || "upload failed."}`);
        if (data.warning) notice = [notice, data.warning].filter(Boolean).join(" ");
      }
      if (activate) {
        try {
          await sendJson(`/api/admin/ads/${adId}/status`, "PATCH", { status: "active" });
        } catch (err) {
          throw new Error(`Saved, but the ad could not be turned ON: ${err.message}`);
        }
      }
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
              text="House ads or free boosts. Shown only when no paid ad is live for the format."
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

            <div className={styles.field}>
              <label className={styles.label} htmlFor="format_id">
                Format &amp; size
                <Required />
              </label>
              <select
                id="format_id"
                value={form.format_id}
                onChange={(e) => update("format_id", e.target.value)}
                disabled={lockFormat}
              >
                <option value="">Choose a format…</option>
                {formats
                  .filter((item) => item.is_active || String(item.id) === String(form.format_id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.width}×{item.height} ({item.format_type})
                      {item.is_active ? "" : " [off]"}
                    </option>
                  ))}
              </select>
              <span className={styles.help}>
                {lockFormat
                  ? "Remove the uploaded image below to change the format."
                  : format
                    ? `Frontend requests this with format=${format.code}`
                    : "The frontend requests ads by format code."}
              </span>
              {fieldError("format_id")}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ content */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Content</h2>
        <p className={styles.cardHint}>
          Link a property, upload a banner, or both. Without an upload the property&apos;s main
          photo is used.
          <br />
          <strong>
            To turn the ad ON you need an image
            <Required />
          </strong>{" "}
          — an uploaded banner, or a linked property with photos.
        </p>

        <div className={styles.stack}>
          <PropertyPicker value={property} onChange={setProperty} />
          {fieldError("property_id")}

          <div className={styles.field}>
            <span className={styles.label}>
              Banner image{" "}
              <span className={styles.optional}>
                {format ? `— any image, automatically fitted to ${format.width}×${format.height}` : ""}
              </span>
            </span>
            <CreativePreview
              format={format}
              src={filePreview || currentImage || property?.image_url || null}
              fit={filePreview && fitInfo && !fitInfo.shapeMatches ? fit : "cover"}
              fallbackNote={!filePreview && !currentImage && property?.image_url}
            />
            {file && fitInfo && (
              <FitChooser
                format={format}
                fileSize={fileSize}
                fitInfo={fitInfo}
                fit={fit}
                onChange={setFit}
              />
            )}
            <div className={styles.buttonRow} style={{ marginTop: 8 }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setRemoveImage(false);
                }}
                style={{ maxWidth: 320 }}
                aria-label="Upload banner image"
              />
              {(file || ad?.image_url) && !removeImage && (
                <button
                  type="button"
                  className={styles.buttonDanger}
                  onClick={() => {
                    setFile(null);
                    if (ad?.image_url) setRemoveImage(true);
                  }}
                >
                  {file ? "Clear selection" : "Remove image"}
                </button>
              )}
              {removeImage && (
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => setRemoveImage(false)}
                >
                  Undo remove
                </button>
              )}
            </div>
            <span className={styles.help}>
              JPG, PNG or WebP up to 5 MB, any size. For the sharpest result use{" "}
              {format ? `${format.width * 2}×${format.height * 2}` : "twice the format size"}.
            </span>
          </div>

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

// Shows the picked file the way the server will fit it (see image route).
function CreativePreview({ format, src, fit = "cover", fallbackNote }) {
  const width = format?.width || 300;
  const height = format?.height || 250;
  const box = { width, maxWidth: "100%", aspectRatio: `${width} / ${height}` };
  return (
    <div>
      <div className={styles.previewFrame}>
        {src && fit === "contain" ? (
          <div className={styles.previewContain} style={box}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden="true" className={styles.previewBlur} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Ad preview" className={styles.previewWhole} />
          </div>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Ad preview" style={{ ...box, objectFit: "cover" }} />
        ) : (
          <div className={styles.previewPlaceholder} style={{ width, aspectRatio: `${width} / ${height}` }}>
            {format ? `${width} × ${height}` : "Choose a format"}
          </div>
        )}
      </div>
      {fallbackNote && (
        <p className={styles.help}>Using the property&apos;s main photo (no banner uploaded).</p>
      )}
    </div>
  );
}

function FitChooser({ format, fileSize, fitInfo, fit, onChange }) {
  const size = `${format.width}×${format.height}`;
  const source = `${fileSize.width}×${fileSize.height}`;

  return (
    <div className={styles.fitChooser}>
      {fitInfo.shapeMatches ? (
        <p className={styles.fitNote}>
          ✓ This image ({source}) already has the right shape — it will be resized to {size}.
        </p>
      ) : (
        <>
          <p className={styles.fitNote}>
            This image is {source}, a different shape from {size}. Choose how to fit it — the
            preview above shows the result.
          </p>
          <div className={styles.fitOptions} role="radiogroup" aria-label="How to fit the image">
            <label className={`${styles.fitOption} ${fit === "cover" ? styles.fitOptionActive : ""}`}>
              <input
                type="radio"
                name="image-fit"
                value="cover"
                checked={fit === "cover"}
                onChange={() => onChange("cover")}
              />
              <span>
                <strong>Crop to fill</strong>
                <span className={styles.help}>Fills the whole banner; edges are trimmed.</span>
              </span>
            </label>
            <label className={`${styles.fitOption} ${fit === "contain" ? styles.fitOptionActive : ""}`}>
              <input
                type="radio"
                name="image-fit"
                value="contain"
                checked={fit === "contain"}
                onChange={() => onChange("contain")}
              />
              <span>
                <strong>Show whole image</strong>
                <span className={styles.help}>Nothing is cut; blurred edges fill the gaps.</span>
              </span>
            </label>
          </div>
        </>
      )}
      {fitInfo.enlarged && (
        <p className={styles.fitWarning}>
          It&apos;s smaller than {size}, so it will be enlarged and may look soft.
        </p>
      )}
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
