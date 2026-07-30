"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    description: "",
    areas_served: "",
    profile_image: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      const res = await fetch("/api/agent/profile");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.agent) {
        setForm({
          full_name: data.agent.full_name || "",
          email: data.agent.email || "",
          phone: data.agent.phone || "",
          description: data.agent.description || "",
          areas_served: data.agent.areas_served || "",
          profile_image: data.agent.profile_image || null,
        });
      }
      setLoading(false);
    })();
  }, [status, router]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/agent/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save profile.");
      return;
    }
    if (selectedImage) {
      const fd = new FormData();
      fd.append("image", selectedImage);
      const imageRes = await fetch("/api/agent/profile-image", { method: "POST", body: fd });
      const imageData = await imageRes.json().catch(() => ({}));
      if (!imageRes.ok) {
        setSaving(false);
        setError(imageData.error || "Profile saved, but the image could not be uploaded.");
        return;
      }
      setForm((prev) => ({ ...prev, profile_image: imageData.profile_image }));
      setSelectedImage(null);
    }
    setSaving(false);
    setSuccess("Profile updated.");
  }

  function selectImage(file) {
    if (!file) return;
    setError("");
    setSelectedImage(file);
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="My Profile"
      subtitle="Update your personal details shown to customers"
    >
      <form className={ui.formCard} onSubmit={saveProfile}>
        {loading ? <p className={ui.muted}>Loading…</p> : null}
        {error ? <p className={ui.error}>{error}</p> : null}
        {success ? <p className={ui.success}>{success}</p> : null}

        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          {imagePreview || form.profile_image ? (
            <Image
              src={imagePreview || form.profile_image}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div className={ui.thumbFallback} style={{ width: 72, height: 72, borderRadius: "50%" }}>
              {(form.full_name || "A").charAt(0)}
            </div>
          )}
          <label className={ui.btnGhost} style={{ cursor: "pointer" }}>
            {selectedImage ? "Picture selected" : "Upload picture"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={saving}
              onChange={(e) => selectImage(e.target.files?.[0])}
            />
          </label>
        </div>

        <label className={ui.field}>
          <span className={ui.label}>Name</span>
          <input
            className={ui.input}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Email</span>
          <input className={ui.input} value={form.email} disabled />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Phone</span>
          <input
            className={ui.input}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Description</span>
          <textarea
            className={ui.textarea}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Areas served</span>
          <input
            className={ui.input}
            value={form.areas_served}
            onChange={(e) => setForm({ ...form, areas_served: e.target.value })}
            placeholder="DHA Lahore, Johar Town, Gulberg"
          />
        </label>
        <div className={ui.formActions}>
          <button type="submit" className={ui.btnPrimary} disabled={saving}>
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
    </AgentPortalShell>
  );
}
