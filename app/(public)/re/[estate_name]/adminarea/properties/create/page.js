"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ImageCategorySelect from "@/components/ImageCategorySelect";
import ui from "@/components/agent-portal/portal.module.css";

const STEPS = [
  "Basic Information",
  "Location",
  "Property Details",
  "Images",
  "Video",
  "Actions",
];

function buildTitle(title, propertyType) {
  const t = String(title || "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (propertyType === "rent" && !lower.includes("rent")) {
    return `${t} for Rent`;
  }
  if (propertyType === "plot" && !lower.includes("plot")) {
    return `${t} Plot`;
  }
  if (propertyType === "sale" && !lower.includes("sale") && !lower.includes("rent") && !lower.includes("plot")) {
    return `${t} for Sale`;
  }
  return t;
}

function buildLocation({ area, phase, address }) {
  return [area, phase, address].map((s) => String(s || "").trim()).filter(Boolean).join(", ");
}

function buildDescription({ description, bedrooms, bathrooms, parking }) {
  const parts = [String(description || "").trim()];
  const meta = [];
  if (bedrooms) meta.push(`Bedrooms: ${bedrooms}`);
  if (bathrooms) meta.push(`Bathrooms: ${bathrooms}`);
  if (parking) meta.push(`Parking: ${parking}`);
  if (meta.length) parts.push(meta.join(" | "));
  return parts.filter(Boolean).join("\n\n") || null;
}

export default function CreatePropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/adminarea`;

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [saving, setSaving] = useState(false);
  // Each entry: { file, url, category, isFeatured }. Position in the array is
  // the display order sent to the API as imageOrder.
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [form, setForm] = useState({
    title: "",
    propertyType: "sale",
    description: "",
    area: "",
    phase: "",
    address: "",
    size_value: "",
    size_unit: "marla",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    price: "",
  });

  useEffect(() => {
    return () => {
      images.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // Object URLs are revoked once, when leaving the page; revoking on every
    // change would break previews that are still on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "unauthenticated") {
    router.replace("/agent/login");
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addFiles(fileList) {
    const added = Array.from(fileList || []).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      category: "",
      isFeatured: false,
    }));
    if (added.length === 0) return;
    setImages((prev) => {
      const next = [...prev, ...added];
      if (!next.some((item) => item.isFeatured)) next[0].isFeatured = true;
      return next;
    });
  }

  function updateImage(index, changes) {
    setImages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }

  /** Exactly one image can be the featured one. */
  function setFeatured(index) {
    setImages((prev) =>
      prev.map((item, i) => ({ ...item, isFeatured: i === index })),
    );
  }

  function moveImage(index, offset) {
    setImages((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeImage(index) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((item) => item.isFeatured)) {
        next[0] = { ...next[0], isFeatured: true };
      }
      return next;
    });
  }

  async function save({ submit = false } = {}) {
    setError("");
    setErrorDetails([]);
    const title = buildTitle(form.title, form.propertyType);
    if (!title) {
      setError("Title is required.");
      setStep(0);
      return;
    }

    setSaving(true);
    try {
      const createRes = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: buildDescription(form),
          location: buildLocation(form) || null,
          size_value: form.size_value ? Number(form.size_value) : null,
          size_unit: form.size_unit || "marla",
          price: form.price ? Number(form.price) : null,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createData.error || "Could not create property.");
      }

      const propertyId = createData.propertyId;
      if (images.length > 0 && propertyId) {
        const fd = new FormData();
        images.forEach((item, index) => {
          fd.append("images", item.file);
          fd.append("imageOrder", String(index));
          fd.append("imageCategories", item.category || "");
          fd.append("isFeatured", item.isFeatured ? "1" : "0");
        });
        const imageRes = await fetch(`/api/properties/${propertyId}/images`, {
          method: "POST",
          body: fd,
        });
        const imageData = await imageRes.json().catch(() => ({}));
        if (!imageRes.ok) {
          throw new Error(imageData.error || "Could not upload property images.");
        }
      }

      if (video && propertyId) {
        const fd = new FormData();
        fd.append("video", video);
        const videoRes = await fetch(`/api/properties/${propertyId}/video`, {
          method: "POST",
          body: fd,
        });
        const videoData = await videoRes.json().catch(() => ({}));
        if (!videoRes.ok) {
          throw new Error(videoData.error || "Could not upload property video.");
        }
      }

      // Submission happens after the uploads so the listing can be validated
      // against its real images.
      if (submit && propertyId) {
        const submitRes = await fetch(`/api/properties/${propertyId}/submit`, {
          method: "POST",
        });
        const submitData = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
          setError(
            `${submitData.error || "Could not submit this property for approval."} It has been saved as a draft.`,
          );
          setErrorDetails(
            Array.isArray(submitData.errors) ? submitData.errors : [],
          );
          setSaving(false);
          return;
        }
      }

      router.push(`${base}/properties`);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Add Property"
      subtitle="Create a draft or submit for approval"
    >
      <div className={ui.formCard}>
        <div className={ui.steps}>
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={`${ui.stepPill} ${step === index ? ui.stepPillActive : ""}`}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        {error ? (
          <div className={ui.error}>
            <p className={ui.noticeTitle}>{error}</p>
            {errorDetails.length > 0 ? (
              <ul className={ui.errorList}>
                {errorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step === 0 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Title</span>
              <input
                className={ui.input}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="10 Marla House in DHA Phase 5"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Property type</span>
              <select
                className={ui.select}
                value={form.propertyType}
                onChange={(e) => update("propertyType", e.target.value)}
              >
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
                <option value="plot">Plot</option>
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <textarea
                className={ui.textarea}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the property"
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Area</span>
              <input
                className={ui.input}
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="DHA Lahore"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phase</span>
              <input
                className={ui.input}
                value={form.phase}
                onChange={(e) => update("phase", e.target.value)}
                placeholder="Phase 5"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Address</span>
              <input
                className={ui.input}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Block / street"
              />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Size</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.size_value}
                  onChange={(e) => update("size_value", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Unit</span>
                <select
                  className={ui.select}
                  value={form.size_unit}
                  onChange={(e) => update("size_unit", e.target.value)}
                >
                  <option value="marla">Marla</option>
                  <option value="kanal">Kanal</option>
                  <option value="sqft">Sqft</option>
                </select>
              </label>
            </div>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Bedrooms</span>
                <input
                  className={ui.input}
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Bathrooms</span>
                <input
                  className={ui.input}
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", e.target.value)}
                />
              </label>
            </div>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Parking</span>
                <input
                  className={ui.input}
                  value={form.parking}
                  onChange={(e) => update("parking", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Price (PKR)</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Upload Images</span>
              <input
                className={ui.input}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {images.length > 0 ? (
              <div className={ui.imageManager}>
                {images.map((item, index) => (
                  <div key={item.url} className={ui.imageCard}>
                    <div className={ui.imageCardThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" />
                      {item.isFeatured ? (
                        <span className={ui.featuredTag}>Featured</span>
                      ) : null}
                    </div>
                    <div className={ui.imageCardBody}>
                      <label className={ui.field}>
                        <span className={ui.imageCardLabel}>Category</span>
                        <ImageCategorySelect
                          className={ui.select}
                          value={item.category}
                          ariaLabel={`Category for image ${index + 1}`}
                          onChange={(category) =>
                            updateImage(index, { category: category || "" })
                          }
                        />
                      </label>
                      <div className={ui.imageCardMeta}>
                        <label className={ui.imageCardCheck}>
                          <input
                            type="radio"
                            name="featured-image"
                            checked={item.isFeatured}
                            onChange={() => setFeatured(index)}
                          />
                          Featured image
                        </label>
                        <span className={ui.imageCardLabel}>
                          Order {index + 1}
                        </span>
                        <div className={ui.imageCardActions}>
                          <button
                            type="button"
                            className={ui.iconBtn}
                            disabled={index === 0}
                            aria-label={`Move image ${index + 1} up`}
                            onClick={() => moveImage(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={ui.iconBtn}
                            disabled={index === images.length - 1}
                            aria-label={`Move image ${index + 1} down`}
                            onClick={() => moveImage(index, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={`${ui.iconBtn} ${ui.iconBtnDanger}`}
                            aria-label={`Remove image ${index + 1}`}
                            onClick={() => removeImage(index)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={ui.muted}>Optional — you can add images later.</p>
            )}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Property Video (Optional)</span>
              <input
                className={ui.input}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg"
                onChange={(e) => setVideo(e.target.files?.[0] || null)}
              />
            </label>
            {video ? (
              <p className={ui.muted}>Selected: {video.name}</p>
            ) : (
              <p className={ui.muted}>Optional — MP4, WebM, MOV, or OGG. One video only.</p>
            )}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className={ui.muted}>
              Save as draft to continue later, or submit for admin approval.
              Drafts never appear on your public website. Submitting needs a
              title, description, location, price, property type, and at least
              one image.
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={saving}
                onClick={() => save()}
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={saving}
                onClick={() => save({ submit: true })}
              >
                {saving ? "Submitting…" : "Submit For Approval"}
              </button>
            </div>
          </>
        ) : null}

        {step < 5 ? (
          <div className={ui.formActions}>
            {step > 0 ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={() => setStep((s) => Math.min(5, s + 1))}
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>
    </AgentPortalShell>
  );
}
