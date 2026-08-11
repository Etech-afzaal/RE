"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import ui from "@/components/agent-portal/portal.module.css";
import { validateCompanyBrandingInput } from "@/lib/validators/userValidator";
import {
  IMAGE_KINDS,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { compressImageForUpload } from "@/lib/clientImageCompress";

export default function CompanyBrandingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [form, setForm] = useState({
    company_name: "",
    description: "",
    office_address: "",
    social_links: "",
    areas_served: "",
    company_logo: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      const res = await fetch("/api/agent/company-branding");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.branding) {
        setForm({
          company_name: data.branding.company_name || "",
          description: data.branding.description || "",
          office_address: data.branding.office_address || "",
          social_links: data.branding.social_links || "",
          areas_served: data.branding.areas_served || "",
          company_logo: data.branding.company_logo || null,
        });
      }
      setLoading(false);
    })();
  }, [status, router]);

  useEffect(() => {
    if (!selectedLogo) {
      setLogoPreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedLogo);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedLogo]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const validated = validateCompanyBrandingInput(form);
    if (!validated.ok) {
      setSaving(false);
      setError(validated.error);
      return;
    }

    const res = await fetch("/api/agent/company-branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...validated.data,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save branding.");
      return;
    }
    if (selectedLogo) {
      const fd = new FormData();
      fd.append("image", selectedLogo);
      const logoRes = await fetch("/api/agent/company-logo", { method: "POST", body: fd });
      const logoData = await logoRes.json().catch(() => ({}));
      if (!logoRes.ok) {
        setSaving(false);
        setError(logoData.error || "Branding saved, but the logo could not be uploaded.");
        return;
      }
      setForm((prev) => ({ ...prev, company_logo: logoData.company_logo }));
      setSelectedLogo(null);
    }
    setSaving(false);
    setSuccess("Company branding updated.");
  }

  async function selectLogo(file) {
    if (!file) return;
    setError("");

    const validated = validateImageUploadFile(file, IMAGE_KINDS.COMPANY_LOGO);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    try {
      const compressed = await compressImageForUpload(file);
      setSelectedLogo(compressed);
    } catch {
      setError(imageProcessErrorMessage());
    }
  }

  async function removeCompanyLogo() {
    setRemovingLogo(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/agent/company-logo", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setRemovingLogo(false);
    if (!res.ok) {
      setError(data.error || "Could not remove company logo.");
      return;
    }
    setForm((prev) => ({ ...prev, company_logo: null }));
    setSelectedLogo(null);
    setConfirmRemoveLogo(false);
    setSuccess("Company logo removed successfully.");
  }

  const showRemoveLogo = Boolean(form.company_logo) && !selectedLogo;

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Company Branding"
      subtitle="Control how your public estate website presents your agency"
    >
      <form className={ui.formCard} onSubmit={save}>
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Loading branding…"
          />
        ) : null}
        {error ? <p className={ui.error}>{error}</p> : null}
        {success ? <p className={ui.success}>{success}</p> : null}

        <div className={ui.brandAssetRow}>
          <div
            className={`${ui.brandAssetPreview} ${ui.brandAssetPreviewSquare}`}
          >
            {logoPreview || form.company_logo ? (
              <Image
                src={logoPreview || form.company_logo}
                alt=""
                width={72}
                height={72}
                style={{ borderRadius: 14, objectFit: "cover" }}
              />
            ) : (
              <div className={ui.thumbFallback} style={{ width: 72, height: 72, borderRadius: 14 }}>
                Co
              </div>
            )}
            {showRemoveLogo ? (
              <button
                type="button"
                className={ui.brandAssetRemove}
                aria-label="Remove company logo"
                disabled={saving || removingLogo}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setConfirmRemoveLogo(true);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <label className={ui.btnGhost} style={{ cursor: "pointer" }}>
            {selectedLogo ? "Logo selected" : "Upload company logo"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={saving || removingLogo}
              onChange={(e) => selectLogo(e.target.files?.[0])}
            />
          </label>
        </div>

        <label className={ui.field}>
          <span className={ui.label}>Company name</span>
          <input
            className={ui.input}
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            placeholder="Johar Living Properties"
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Company description</span>
          <textarea
            className={ui.textarea}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Office address</span>
          <input
            className={ui.input}
            value={form.office_address}
            onChange={(e) =>
              setForm({ ...form, office_address: e.target.value })
            }
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Areas served</span>
          <input
            className={ui.input}
            value={form.areas_served}
            onChange={(e) => setForm({ ...form, areas_served: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Social links</span>
          <textarea
            className={ui.textarea}
            value={form.social_links}
            onChange={(e) => setForm({ ...form, social_links: e.target.value })}
            placeholder="One URL per line"
          />
        </label>
        <div className={ui.formActions}>
          <button type="submit" className={ui.btnPrimary} disabled={saving || removingLogo}>
            {saving ? "Saving…" : "Save Branding"}
          </button>
        </div>
      </form>

      {confirmRemoveLogo ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-company-logo-title"
            aria-describedby="remove-company-logo-description"
          >
            <h2 id="remove-company-logo-title" className={ui.dialogTitle}>
              Remove Company Logo?
            </h2>
            <p id="remove-company-logo-description" className={ui.dialogText}>
              Are you sure you want to remove this company logo? This action
              cannot be undone.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={removingLogo}
                onClick={() => setConfirmRemoveLogo(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={removingLogo}
                onClick={removeCompanyLogo}
              >
                {removingLogo ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
