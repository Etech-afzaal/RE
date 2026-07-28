"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ui from "@/components/agent-portal/portal.module.css";

const STEPS = [
  "Basic Information",
  "Location",
  "Property Details",
  "Images",
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
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
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

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  if (status === "unauthenticated") {
    router.replace("/agent/login");
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(nextStatus) {
    setError("");
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
          status: nextStatus,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createData.error || "Could not create property.");
      }

      const propertyId = createData.propertyId;
      if (files.length > 0 && propertyId) {
        const fd = new FormData();
        files.forEach((file, index) => {
          fd.append("images", file);
          fd.append("imageOrder", String(index));
          fd.append("isFeatured", index === 0 ? "1" : "0");
        });
        await fetch(`/api/properties/${propertyId}/images`, {
          method: "POST",
          body: fd,
        });
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

        {error ? <p className={ui.error}>{error}</p> : null}

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
              <span className={ui.label}>Images</span>
              <input
                className={ui.input}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setFiles((prev) => [
                    ...prev,
                    ...Array.from(e.target.files || []),
                  ])
                }
              />
            </label>
            {previews.length > 0 ? (
              <div className={ui.previewGrid}>
                {previews.map((item, index) => (
                  <div key={item.url} className={ui.previewItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" />
                    <button
                      type="button"
                      className={ui.removePreview}
                      onClick={() => removeFile(index)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
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
            <p className={ui.muted}>
              Save as draft to continue later, or submit for admin approval.
              Drafts never appear on your public website.
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={saving}
                onClick={() => save("draft")}
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={saving}
                onClick={() => save("pending_approval")}
              >
                {saving ? "Submitting…" : "Submit For Approval"}
              </button>
            </div>
          </>
        ) : null}

        {step < 4 ? (
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
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>
    </AgentPortalShell>
  );
}
