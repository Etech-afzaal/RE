"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpWideNarrow,
  Banknote,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  Crown,
  Eye,
  Gift,
  House,
  Images,
  Link2,
  ListChecks,
  MapPin,
  Megaphone,
  MousePointerClick,
  Phone,
  Power,
  Receipt,
  Save,
  Shuffle,
  Type,
  UserRound,
  Wallet,
} from "lucide-react";
import { MAX_SLIDES, SLIDE_MS, formatCodesForLocations } from "@/lib/ads/locations";
import AdsDialog from "./AdsDialog";
import LocationPicker from "./LocationPicker";
import SizesPanel, { readImageFile, resolveSizes, sizeText } from "./SizesPanel";
import { formatPrice, fromLocalInput, toLocalInput } from "./adUi";
import styles from "./ads.module.css";
import f from "./adForm.module.css";

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

// header: { backHref, backLabel, title, subtitle } — the page title row, with the save buttons.
export default function AdForm({ ad = null, initialError = "", header = null }) {
  const router = useRouter();
  const isEdit = Boolean(ad);
  const [form, setForm] = useState(() => toForm(ad));
  const [property, setProperty] = useState(() => propertyFromAd(ad));
  const [formats, setFormats] = useState([]);
  // Where the ad shows; its sizes follow from these (lib/ads/locations.js).
  const [locations, setLocations] = useState(() => ad?.locations || []);
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
      .then((data) => setFormats(data.formats || []))
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

  const sizeIds = useMemo(() => {
    const codes = formatCodesForLocations(locations);
    return formats.filter((format) => codes.includes(format.code)).map((format) => format.id);
  }, [formats, locations]);

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

  function changeLocations(keys) {
    setLocations(keys);
    setFieldErrors((current) => ({ ...current, locations: undefined }));
  }

  // Needed for any save (mirrors the server's validation).
  const saveChecks = [
    { key: "title", label: "Internal title", done: form.title.trim().length > 0 },
    { key: "locations", label: "At least one location", done: locations.length > 0 },
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
      locations,
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

  const defaultDestination = property?.url || "https://… or /some/page";
  const canTurnOn = ad?.status !== "active";

  // Save buttons, shown in the header and again under the checklist.
  const actions = (withCancel) => (
    <>
      {withCancel && (
        <button type="button" className={f.btnQuiet} onClick={() => router.back()} disabled={saving}>
          Cancel
        </button>
      )}
      <button type="submit" className={canTurnOn ? f.btnSecondary : f.btnPrimary} disabled={saving}>
        <Save size={16} aria-hidden="true" />
        {saving ? "Saving…" : isEdit ? "Save changes" : "Save as draft"}
      </button>
      {canTurnOn && (
        <button type="button" className={f.btnPrimary} disabled={saving} onClick={() => trySubmit(true)}>
          <Power size={16} aria-hidden="true" />
          {saving ? "Saving…" : "Save & turn ON"}
        </button>
      )}
    </>
  );

  const text = (key, props = {}) => ({
    id: key,
    value: form[key],
    onChange: (e) => update(key, e.target.value),
    ...props,
  });

  return (
    <form
      className={f.form}
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

      {header && (
        <header className={f.header}>
          <div className={f.headerText}>
            <Link href={header.backHref} className={f.back}>
              <ArrowLeft size={16} aria-hidden="true" /> {header.backLabel}
            </Link>
            <h1 className={f.title}>{header.title}</h1>
            <p className={f.subtitle}>{header.subtitle}</p>
          </div>
          <div className={f.actions}>{actions(false)}</div>
        </header>
      )}

      {/* ------------------------------------------------ ad type */}
      <Section icon={Megaphone} title="Ad type" hint="Who pays decides the priority on the customer site.">
        <div className={f.choiceGrid} role="radiogroup" aria-label="Ad type">
          <ChoiceCard
            icon={Crown}
            name="tier"
            checked={form.tier === "paid"}
            onChange={() => update("tier", "paid")}
            title="Paid / Featured"
            text="Always shown before free ads. Needs an end date (flat fee per period)."
          />
          <ChoiceCard
            icon={Gift}
            name="tier"
            checked={form.tier === "free"}
            onChange={() => update("tier", "free")}
            title="Free"
            text="House ads or free boosts. Shown after the paid ads in each location's carousel."
          />
        </div>
        <div className={f.half}>
          <Field id="title" label="Internal title" required help="Only admins see this." error={fieldErrors.title}>
            <input {...text("title")} placeholder="e.g. DHA Phase 6 house — October feature" />
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------ locations */}
      <Section
        icon={MapPin}
        title="Location"
        hint={`Where the ad shows. Each location shows its live ads as a carousel: paid ads first, up to ${MAX_SLIDES}, changing every ${SLIDE_MS / 1000} seconds.`}
      >
        <Field id="locations" label="Show this ad in" required error={fieldErrors.locations}>
          <LocationPicker
            id="locations"
            value={locations}
            onChange={changeLocations}
            invalid={Boolean(fieldErrors.locations)}
          />
        </Field>
      </Section>

      {/* ------------------------------------------------ sizes */}
      <Section
        icon={Images}
        title="Sizes & images"
        hint="One ad, every screen. Upload one main image and each size is cropped from it automatically."
      >
        <SizesPanel
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
        />
      </Section>

      {/* ------------------------------------------------ content */}
      <Section
        icon={Type}
        title="Content"
        hint="Text and link are shared by every size. Linking a property also lets sizes without an image use its photo."
      >
        <div>
          <PropertyPicker value={property} onChange={setProperty} />
          {fieldErrors.property_id && <p className={f.error}>{fieldErrors.property_id}</p>}
        </div>

        <div className={f.cols2}>
          <Field id="headline" label="Headline" note="optional" count={form.headline.length} max={120} error={fieldErrors.headline}>
            <input {...text("headline")} maxLength={120} placeholder={property?.title || "Shown on native/text layouts"} />
          </Field>
          <Field id="cta_text" label="Button text" note="optional" count={form.cta_text.length} max={40} error={fieldErrors.cta_text}>
            <input {...text("cta_text")} maxLength={40} placeholder={property ? "View property" : "Learn more"} />
          </Field>
          <Field id="alt_text" label="Image alt text" note="accessibility" count={form.alt_text.length} max={255} error={fieldErrors.alt_text}>
            <input {...text("alt_text")} maxLength={255} placeholder="Describe the banner for screen readers" />
          </Field>
          <Field
            id="click_url"
            label="Click destination"
            note="optional"
            help="Leave empty to open the linked property. Site paths or https:// links only."
            error={fieldErrors.click_url}
          >
            <IconInput icon={Link2}>
              <input {...text("click_url")} placeholder={defaultDestination} />
            </IconInput>
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------ schedule */}
      <Section
        icon={CalendarClock}
        title="Schedule & delivery"
        hint="When the ad can appear, and how often it's picked."
      >
        <Group title="When it runs">
          <div className={f.cols2}>
            <Field
              id="start_at"
              label="Starts"
              required
              help="Not shown before this time. A future date shows as Scheduled and goes live on its own."
              error={fieldErrors.start_at}
            >
              <IconInput icon={CalendarDays}>
                <input {...text("start_at")} type="datetime-local" />
              </IconInput>
            </Field>
            <Field
              id="end_at"
              label="Ends"
              required={isPaid}
              note={isPaid ? "required for paid ads" : "optional"}
              help={
                isPaid
                  ? "Stops showing after this time. Paid ads cover a fixed period."
                  : "Stops showing after this time. Leave empty to run with no end."
              }
              error={fieldErrors.end_at}
            >
              <IconInput icon={CalendarDays}>
                <input {...text("end_at")} type="datetime-local" />
              </IconInput>
              <div className={f.quickPicks}>
                {[7, 15, 30, 90].map((days) => (
                  <button key={days} type="button" className={f.quickPick} onClick={() => setEndInDays(days)}>
                    +{days} days
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Group>

        <Group
          title="Rotation"
          hint="Paid always beats free; then the higher priority wins; equal priorities take turns by weight."
        >
          <div className={f.cols2}>
            <Field id="priority" label="Priority" note="1–10" help="Highest number wins within the tier. Use 9–10 for the top spot." error={fieldErrors.priority}>
              <IconInput icon={ArrowUpWideNarrow}>
                <input {...text("priority")} type="number" min={1} max={10} step={1} />
              </IconInput>
            </Field>
            <Field id="weight" label="Rotation weight" note="1–1000" help="Share among equal priorities: 200 vs 100 ≈ 67% / 33%." error={fieldErrors.weight}>
              <IconInput icon={Shuffle}>
                <input {...text("weight")} type="number" min={1} max={1000} step={1} />
              </IconInput>
            </Field>
          </div>
        </Group>

        <Group title="Limits" hint="Empty means unlimited. All sizes count together.">
          <div className={f.cols4}>
            <Field id="max_impressions" label="Max impressions" help="Views for the whole campaign (half on screen for 1s)." error={fieldErrors.max_impressions}>
              <IconInput icon={Eye}>
                <input {...text("max_impressions")} type="number" min={1} step={1} placeholder="Unlimited" />
              </IconInput>
            </Field>
            <Field id="max_clicks" label="Max clicks" help="Clicks for the whole campaign." error={fieldErrors.max_clicks}>
              <IconInput icon={MousePointerClick}>
                <input {...text("max_clicks")} type="number" min={1} step={1} placeholder="Unlimited" />
              </IconInput>
            </Field>
            <Field id="daily_impression_cap" label="Impressions / day" help="Pauses for the rest of the day (Pakistan time)." error={fieldErrors.daily_impression_cap}>
              <IconInput icon={CalendarClock}>
                <input {...text("daily_impression_cap")} type="number" min={1} step={1} placeholder="Unlimited" />
              </IconInput>
            </Field>
            <Field id="viewer_cap_24h" label="Per visitor / 24h" help="After this a visitor gets the next ad." error={fieldErrors.viewer_cap_24h}>
              <IconInput icon={UserRound}>
                <input {...text("viewer_cap_24h")} type="number" min={1} step={1} placeholder="Unlimited" />
              </IconInput>
            </Field>
          </div>
        </Group>
      </Section>

      {/* ------------------------------------------------ advertiser */}
      <Section
        icon={Wallet}
        title={isPaid ? "Advertiser & payment" : "Advertiser"}
        hint="For your records only. Payments are handled manually — nothing here charges anyone."
      >
        <div className={f.cols2}>
          <Field id="advertiser_name" label="Advertiser" note="optional">
            <IconInput icon={Building2}>
              <input {...text("advertiser_name")} placeholder={property?.agent_name || "Agent, developer, bank…"} />
            </IconInput>
          </Field>
          <Field id="advertiser_contact" label="Contact" note="optional">
            <IconInput icon={Phone}>
              <input {...text("advertiser_contact")} placeholder="Phone or email" />
            </IconInput>
          </Field>
          {isPaid && (
            <>
              <Field id="amount_paid" label="Amount paid (PKR)" note="optional" error={fieldErrors.amount_paid}>
                <IconInput icon={Banknote}>
                  <input {...text("amount_paid")} type="number" min={0} step="0.01" placeholder="0" />
                </IconInput>
              </Field>
              <Field id="payment_ref" label="Payment reference" note="optional">
                <IconInput icon={Receipt}>
                  <input {...text("payment_ref")} placeholder="Receipt / transaction no." />
                </IconInput>
              </Field>
            </>
          )}
        </div>
        <Field id="notes" label="Notes" note="optional">
          <textarea id="notes" rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </Field>
      </Section>

      {/* ------------------------------------------------ checklist */}
      <section className={f.section} aria-label="Checklist">
        <div className={f.sectionHead}>
          <span className={f.sectionIcon}>
            <ListChecks size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className={f.sectionTitle}>Checklist</h2>
            <p className={f.sectionHint}>
              Fields marked <span className={f.required}>*</span> are required. Items tick
              themselves off as you fill the form.
            </p>
          </div>
        </div>
        <div className={f.checklistGrid}>
          <Checklist heading="Required to save" checks={saveChecks} />
          <Checklist heading="Required to turn ON" checks={turnOnChecks} />
        </div>
        <div className={f.footer}>{actions(true)}</div>
      </section>
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

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className={f.section}>
      <div className={f.sectionHead}>
        <span className={f.sectionIcon}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className={f.sectionTitle}>{title}</h2>
          {hint && <p className={f.sectionHint}>{hint}</p>}
        </div>
      </div>
      <div className={f.sectionBody}>{children}</div>
    </section>
  );
}

function Group({ title, hint, children }) {
  return (
    <div className={f.group}>
      <div className={f.groupHead}>
        <span className={f.groupTitle}>{title}</span>
        {hint && <span className={f.groupHint}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Label row (required marker, note, character counter) + input + help + error.
function Field({ id, label, required = false, note, count, max, help, error, children }) {
  return (
    <div className={f.field}>
      <div className={f.labelRow}>
        <label className={f.label} htmlFor={id}>
          {label}
          {required && (
            <span className={f.required} aria-label="required" title="Required">
              *
            </span>
          )}
          {note && <span className={f.note}> ({note})</span>}
        </label>
        {max != null && (
          <span className={`${f.counter} ${count >= max ? f.counterFull : ""}`} aria-live="polite">
            {count}/{max}
          </span>
        )}
      </div>
      {children}
      {help && <span className={f.help}>{help}</span>}
      {error && <p className={f.error}>{error}</p>}
    </div>
  );
}

function IconInput({ icon: Icon, children }) {
  return (
    <div className={f.withIcon}>
      <Icon size={16} aria-hidden="true" />
      {children}
    </div>
  );
}

function ChoiceCard({ icon: Icon, name, checked, onChange, title, text }) {
  return (
    <label className={`${f.choice} ${checked ? f.choiceActive : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className={f.choiceIcon}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className={f.choiceBody}>
        <span className={f.choiceTitle}>{title}</span>
        <span className={f.choiceText}>{text}</span>
      </span>
      <span className={f.marker} aria-hidden="true">
        {checked && <Check size={13} strokeWidth={3.5} />}
      </span>
    </label>
  );
}

function Checklist({ heading, checks }) {
  const doneCount = checks.filter((check) => check.done).length;
  const complete = doneCount === checks.length;
  return (
    <div>
      <p className={f.checklistHead}>
        <span>{heading}</span>
        <span>
          {doneCount}/{checks.length}
        </span>
      </p>
      <div className={f.progress} aria-hidden="true">
        <div
          className={`${f.progressBar} ${complete ? f.progressDone : ""}`}
          style={{ width: `${checks.length ? (doneCount / checks.length) * 100 : 100}%` }}
        />
      </div>
      <ul className={f.checklist}>
        {checks.map((check) => (
          <li key={check.key} className={`${f.checkItem} ${check.done ? f.checkDone : ""}`}>
            {check.done ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
            <span>
              {check.label}
              <span className="sr-only">{check.done ? " (done)" : " (not done)"}</span>
              {!check.done && check.hint && <span className={f.checkHint}>{check.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
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
        <span className={f.label}>Linked property</span>
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
      <label className={f.label} htmlFor="property-search">
        Linked property <span className={f.note}>(optional)</span>
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
          <button type="button" className={f.pickerButton} onClick={() => setOpen(true)}>
            <House size={16} aria-hidden="true" />
            <span>Choose a property…</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
